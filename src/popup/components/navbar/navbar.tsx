import React, { useState, useEffect } from 'react';
import './navbar.scss';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { browser } from 'webextension-polyfill-ts';
import { motion, AnimatePresence } from 'framer-motion';
import { resizeFrame, FrameDimensions } from '../../../services/frame';

import BitpayLogo from './bp-logo/bp-logo';
import BackButton from './back-button/back-button';

const animateNav = {
  base: {
    background: '#FFFFFF',
    transition: {
      type: 'tween',
      duration: 0.25,
      delay: 0
    }
  },
  pay: {
    background: '#0C204E',
    transition: {
      type: 'tween',
      duration: 0.25,
      delay: 0.25
    }
  }
};

const Navbar: React.FC<RouteComponentProps> = ({ history, location }) => {
  const [preCollapseHeight, setPreCollapseHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const payMode = payVisible && collapsed;
  const goBack = (): void => {
    if (collapsed) {
      setCollapsed(false);
    }
    history.goBack();
  };
  const collapse = (): void => {
    setPreCollapseHeight(document.body.offsetHeight);
    setCollapsed(true);
    resizeFrame(FrameDimensions.collapsedHeight);
  };
  const expand = (): void => {
    setCollapsed(false);
    resizeFrame(preCollapseHeight);
  };
  const close = (): void => {
    browser.runtime.sendMessage({ name: 'POPUP_CLOSED' });
  };
  const routesWithBackButton = ['/brand', '/card', '/amount', '/payment', '/settings/', '/category'];
  const showBackButton = routesWithBackButton.some(route => location.pathname.startsWith(route));
  useEffect(() => {
    const payReady = (mode: boolean) => (): void => setPayVisible(mode);
    window.addEventListener('PAY_VISIBLE', payReady(true));
    window.addEventListener('PAY_HIDDEN', payReady(false));
    return (): void => {
      window.removeEventListener('PAY_VISIBLE', payReady(true));
      window.removeEventListener('PAY_HIDDEN', payReady(false));
    };
  }, []);
  return (
    <motion.div className="header-bar fixed" animate={payMode ? 'pay' : 'base'} variants={animateNav}>
      <AnimatePresence>{showBackButton && !payMode && <BackButton onClick={goBack} />}</AnimatePresence>

      <BitpayLogo solo={showBackButton} />

      <div className="header-bar__controls">
        <motion.button
          whileTap={{ scale: 0.96 }}
          type="button"
          onClick={collapsed ? expand : collapse}
          className="header-bar__controls__toggle--wrapper"
        >
          <AnimatePresence>
            <motion.img
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 180 }}
              alt="toggle"
              src={`../assets/icons/${collapsed ? 'expand' : 'minimize'}-icon.svg`}
              key={`${collapsed ? 'expand' : 'minimize'}`}
              className="header-bar__controls__toggle"
            />
          </AnimatePresence>
        </motion.button>

        <button type="button" onClick={close}>
          <img alt="exit" src="../assets/icons/exit-icon.svg" />
        </button>
      </div>
    </motion.div>
  );
};

export default withRouter(Navbar);
