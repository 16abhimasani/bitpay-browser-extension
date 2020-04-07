import React, { useRef, useEffect, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { usePopupState, bindTrigger, bindMenu } from 'material-ui-popup-state/hooks';
import { Tooltip, makeStyles, createStyles } from '@material-ui/core';
import { GiftCard, CardConfig } from '../../../services/gift-card.types';
import './card.scss';
import { set } from '../../../services/storage';
import { resizeToFitPage } from '../../../services/frame';
import { launchNewTab } from '../../../services/browser';
import { redeemGiftCard } from '../../../services/gift-card';
import { wait } from '../../../services/utils';
import LineItems from '../../components/line-items/line-items';
import CardHeader from '../../components/card-header/card-header';
import CodeBox from '../../components/code-box/code-box';

const Card: React.FC<RouteComponentProps & {
  purchasedGiftCards: GiftCard[];
  setPurchasedGiftCards: (cards: GiftCard[]) => void;
}> = ({ location, history, purchasedGiftCards, setPurchasedGiftCards }) => {
  const useStyles = makeStyles(() =>
    createStyles({
      customWidth: {
        borderRadius: '6px',
        color: 'white',
        backgroundColor: '#303133',
        maxWidth: 200,
        padding: '12px 15px',
        fontWeight: 400,
        fontSize: '11px',
        textAlign: 'center',
        top: '10px'
      }
    })
  );
  const classes = useStyles();

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    resizeToFitPage(ref, 80);
  }, [ref]);
  const { card: giftCard, cardConfig } = location.state as { card: GiftCard; cardConfig: CardConfig };
  const [card, setCard] = useState(giftCard);
  const initiallyArchived = giftCard.archived;
  const redeemUrl = `${cardConfig.redeemUrl}${card.claimCode}`;
  const popupState = usePopupState({ variant: 'popover', popupId: 'cardActions' });
  const launchClaimLink = (): void => {
    const url = cardConfig.defaultClaimCodeType === 'link' ? (card.claimLink as string) : redeemUrl;
    launchNewTab(url);
  };
  const shouldShowRedeemButton = (): boolean => !!(cardConfig.redeemUrl || cardConfig.defaultClaimCodeType === 'link');
  const updatePurchasedCards = async (cardToUpdate: GiftCard): Promise<void> => {
    const newCards = purchasedGiftCards.map(purchasedCard =>
      purchasedCard.invoiceId === cardToUpdate.invoiceId ? { ...purchasedCard, ...cardToUpdate } : { ...purchasedCard }
    );
    await set<GiftCard[]>('purchasedGiftCards', newCards);
    setPurchasedGiftCards(newCards);
  };
  const updateCard = async (cardToUpdate: GiftCard): Promise<void> => {
    await updatePurchasedCards(cardToUpdate);
    setCard(cardToUpdate);
  };
  const archive = async (): Promise<void> => {
    updateCard({ ...card, archived: true });
    initiallyArchived ? resizeToFitPage(ref, 80) : history.goBack();
  };
  const resizePageBeforeRerender = (): void => {
    const paddingBottom = shouldShowRedeemButton() ? 136 : 80;
    resizeToFitPage(ref, paddingBottom);
  };
  const unarchive = async (): Promise<void> => {
    await updatePurchasedCards(card);
    resizePageBeforeRerender();
    await wait(300);
    updateCard({ ...card, archived: false });
  };
  const handleMenuClick = (item: string): void => {
    switch (item) {
      case 'Edit Balance':
        console.log('edit balance');
        break;
      case 'Archive':
        archive();
        break;
      case 'Unarchive':
        unarchive();
        break;
      case 'Help':
        return launchNewTab('https://bitpay.com/request-help');
      default:
        console.log('Unknown Menu Option Selected');
    }
    popupState.close();
  };
  const redeem = async (): Promise<void> => {
    const updatedGiftCard = await redeemGiftCard(card);
    const fullCard = { ...card, ...updatedGiftCard };
    await updateCard(fullCard);
    resizeToFitPage(ref, 80);
  };
  useEffect((): void => {
    if (card.status === 'PENDING') redeem();
  });
  return (
    <div className="card-details">
      <div className="card-details__content" ref={ref}>
        <button className="card-details__more" type="button" {...bindTrigger(popupState)}>
          <img src="../../assets/icons/dots.svg" alt="More" />
        </button>
        <Menu
          {...bindMenu(popupState)}
          getContentAnchorEl={null}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          className="card-details__more__menu"
          style={{ boxShadow: 'none' }}
        >
          {['Edit Balance', card.archived ? 'Unarchive' : 'Archive', 'Help'].map(option => (
            <MenuItem
              className="card-details__more__menu__item"
              key={option}
              onClick={(): void => handleMenuClick(option)}
            >
              {option}
            </MenuItem>
          ))}
        </Menu>
        <CardHeader cardConfig={cardConfig} card={card} />
        <LineItems cardConfig={cardConfig} card={card} />
        {card.status === 'SUCCESS' && cardConfig.defaultClaimCodeType !== 'link' && (
          <div style={{ marginTop: '10px' }}>
            <CodeBox label="Claim Code" code={card.claimCode} />
            {card.pin && <CodeBox label="Pin" code={card.pin} />}
          </div>
        )}

        {card.status === 'SUCCESS' && !card.archived && shouldShowRedeemButton() && (
          <div className="action-button__footer">
            <button className="action-button" type="button" onClick={(): void => launchClaimLink()}>
              Redeem Now
            </button>
          </div>
        )}

        {card.status === 'PENDING' && (
          <>
            <Tooltip
              title="We’ll update your claim code here when your payment confirms"
              placement="top"
              classes={{ tooltip: classes.customWidth }}
              arrow
            >
              <div className="action-button__footer">
                <button className="action-button action-button--warn" type="button" onClick={redeem}>
                  Pending Confirmation
                </button>
              </div>
            </Tooltip>
          </>
        )}
        {card.status === 'FAILURE' && (
          <>
            <Tooltip
              title="Could not get claim code. Please contact BitPay Support."
              placement="top"
              classes={{ tooltip: classes.customWidth }}
              arrow
            >
              <div className="action-button__footer">
                <button
                  className="action-button action-button--danger"
                  type="button"
                  onClick={(): void => handleMenuClick('Help')}
                >
                  Something Went Wrong
                </button>
              </div>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};

export default Card;
