import React, { useState, useEffect } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import classNames from 'classnames';
import { browser } from 'webextension-polyfill-ts';
import { GiftCard, CardConfig, GiftCardInvoiceParams } from '../../../services/gift-card.types';
import { set } from '../../../services/storage';
import { createBitPayInvoice, redeemGiftCard, getBitPayInvoice, isAmountValid } from '../../../services/gift-card';
import Snack from '../snack/snack';
import { waitForServerEvent, deleteCard } from '../../../services/gift-card-storage';
import { wait } from '../../../services/utils';
import { BitpayUser } from '../../../services/bitpay-id';
import { injectClaimInfo } from '../../../services/browser';
import { PayWithBitpayImage } from '../svg/pay-with-bitpay-image';
import { Merchant } from '../../../services/merchant';
import './pay-with-bitpay.scss';

const PayWithBitpay: React.FC<Partial<RouteComponentProps> & {
  cardConfig: CardConfig;
  invoiceParams: GiftCardInvoiceParams;
  setEmail?: (email: string) => void;
  user?: BitpayUser;
  purchasedGiftCards: GiftCard[];
  setPurchasedGiftCards: (cards: GiftCard[]) => void;
  supportedMerchant?: Merchant;
  onInvalidParams?: () => void;
}> = ({
  cardConfig,
  invoiceParams,
  history,
  setEmail,
  user,
  purchasedGiftCards,
  setPurchasedGiftCards,
  supportedMerchant,
  onInvalidParams = (): void => undefined
}) => {
  const [errorMessage, setErrorMessage] = useState('');
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const { amount, currency } = invoiceParams;
  const onMerchantWebsite = supportedMerchant?.name === cardConfig.name;
  const saveGiftCard = async (card: GiftCard): Promise<void> => {
    const newPurchasedGiftCards = [...purchasedGiftCards, card];
    setPurchasedGiftCards(newPurchasedGiftCards);
    await set<GiftCard[]>('purchasedGiftCards', newPurchasedGiftCards);
  };
  const deleteGiftCard = async (card: GiftCard): Promise<void> => {
    const newCards = await deleteCard(card, purchasedGiftCards);
    setPurchasedGiftCards(newCards);
  };
  const showCard = (card: GiftCard): void => {
    if (!history) return;
    history.goBack();
    history.goBack();
    history.push(`/wallet`);
    history.push({ pathname: `/card/${card.invoiceId}`, state: { card, cardConfig } });
  };
  const launchInvoice = async (): Promise<void> => {
    if (!isAmountValid(amount, cardConfig)) {
      return onInvalidParams();
    }
    setAwaitingPayment(true);
    const { invoiceId, accessKey, totalDiscount } = await createBitPayInvoice({ params: invoiceParams, user });
    if (setEmail) {
      await set<string>('email', invoiceParams.email as string);
      setEmail(invoiceParams.email as string);
    }
    const unredeemedGiftCard = {
      currency,
      date: new Date().toISOString(),
      amount,
      clientId: invoiceParams.clientId,
      accessKey,
      invoiceId,
      name: invoiceParams.brand,
      totalDiscount,
      status: 'UNREDEEMED'
    } as GiftCard;
    await saveGiftCard(unredeemedGiftCard);
    const launchPromise = browser.runtime.sendMessage({
      name: 'LAUNCH_WINDOW',
      url: `${process.env.API_ORIGIN}/invoice?id=${invoiceId}&view=popup`
    });
    const res = await Promise.race([
      launchPromise,
      waitForServerEvent(unredeemedGiftCard).catch(async () => {
        await wait(1000 * 60 * 15);
        Promise.resolve({ data: { status: 'closed' } });
      })
    ]);
    if (res.data && res.data.status === 'closed') {
      await deleteGiftCard(unredeemedGiftCard);
      setAwaitingPayment(false);
      return;
    }
    const [invoice, giftCard] = await Promise.all([getBitPayInvoice(invoiceId), redeemGiftCard(unredeemedGiftCard)]);
    const finalGiftCard = {
      ...giftCard,
      discounts: cardConfig.discounts,
      invoice
    } as GiftCard;
    await saveGiftCard(finalGiftCard);
    showCard(finalGiftCard);
    if (finalGiftCard.status === 'SUCCESS' && cardConfig.cssSelectors && onMerchantWebsite) {
      injectClaimInfo(cardConfig, { claimCode: finalGiftCard.claimCode, pin: finalGiftCard.pin });
    }
  };
  const snackOnClose = (): void => {
    setErrorMessage('');
  };
  const payButton = (): Promise<void> =>
    launchInvoice().catch(err => {
      setErrorMessage(err.message || 'An unexpected error occurred');
      setAwaitingPayment(false);
    });
  useEffect(() => {
    window.dispatchEvent(new Event('PAY_VISIBLE'));
    return (): void => {
      window.dispatchEvent(new Event('PAY_HIDDEN'));
    };
  }, []);
  return (
    <>
      <div className="pay-with-bitpay">
        <Snack message={errorMessage} onClose={snackOnClose} />
        {awaitingPayment ? (
          <>
            <div className="action-button action-button--pending">
              <img className="action-button__spinner" src="../../assets/icons/spinner.svg" alt="spinner" /> Awaiting
              Payment
            </div>
          </>
        ) : (
          <button
            className={classNames({
              disabled: !invoiceParams.email,
              'pay-with-bitpay__pay-button': true
            })}
            type="button"
            onClick={payButton}
            disabled={!invoiceParams.email}
          >
            <PayWithBitpayImage />
          </button>
        )}
      </div>
    </>
  );
};

export default PayWithBitpay;
