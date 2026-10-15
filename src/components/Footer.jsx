import React from 'react'
import { useAccessibility } from '../accessibility'

function Footer({ onOpenAbout }) {
  const { t } = useAccessibility()
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-col">
          <h3>{t('ABOUT')}</h3>
          <ul>
            <li>{t('Contact Us')}</li>
            <li><button className="footer-link" type="button" onClick={onOpenAbout}>{t('About Us')}</button></li>
            <li>{t('Careers')}</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>{t('POLICY')}</h3>
          <ul>
            <li>{t('Return Policy')}</li>
            <li>{t('Privacy Policy')}</li>
            <li>{t('Terms of Use')}</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>{t('HELP')}</h3>
          <ul>
            <li>{t('FAQs')}</li>
            <li>{t('Shipping')}</li>
            <li>{t('Payment')}</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>{t('FOLLOW US')}</h3>
          <ul>
            <li>Instagram</li>
            <li>Facebook</li>
            <li>Twitter</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>© {new Date().getFullYear()} BookStore. All rights reserved.</div>
        <div className="footer-bottom-links">{t('Made with ❤️ for learning UI/UX')}</div>
      </div>
    </footer>
  )
}

export default Footer
