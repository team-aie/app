import { getCurrentWindow } from '@electron/remote';
import React, { CSSProperties, FC, Fragment, useContext, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import { useTranslation } from 'react-i18next';

import { version } from '../../../../package.json';
import { ThemeContext } from '../../contexts';
import LICENSES, { LicenseInfo } from '../../licenses';
import { SupportedTheme } from '../../types';

const openDevTool = (): void => {
  getCurrentWindow().webContents.openDevTools({ mode: 'detach' });
};

type LicenseTextModalProps = LicenseInfo;

const LicenseDetails: FC<LicenseTextModalProps> = ({ name, version, author, repository, license, licenseText }) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const hideDetails = (): void => setShow(false);
  return (
    <Fragment>
      <Button variant={'outline-secondary'} onClick={(): void => setShow(true)}>
        {t('Show')}
      </Button>
      <Modal show={show} onHide={hideDetails} centered>
        <Modal.Body>
          <Table>
            <tbody>
              <tr>
                <td className={'border-top-0 border-right'}>{t('Name')}</td>
                <td className={'border-top-0'}>{name}</td>
              </tr>
              <tr>
                <td className={'border-top-0 border-right'}>{t('Version')}</td>
                <td className={'border-top-0'}>{version}</td>
              </tr>
              {author && (
                <tr>
                  <td className={'border-top-0 border-right'}>{t('Author')}</td>
                  <td className={'border-top-0'}>{author}</td>
                </tr>
              )}
              {repository && (
                <tr>
                  <td className={'border-top-0 border-right'}>{t('Repository')}</td>
                  <td className={'border-top-0'}>{repository}</td>
                </tr>
              )}
              <tr>
                <td className={'border-top-0 border-right'}>{t('License')}</td>
                <td className={'border-top-0'}>{license}</td>
              </tr>
              <tr>
                <td className={'border-top-0 border-right'}>{t('License Text')}</td>
                <td className={'border-top-0'}>{licenseText}</td>
              </tr>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={hideDetails} variant={'outline-success'}>
            {t('Close')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Fragment>
  );
};

const LicenseDisclosure: FC<{ triggerStyle?: CSSProperties }> = ({ triggerStyle }) => {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const [showModal, setShowModal] = useState(false);
  const hideLicenseDisclosure = (): void => setShowModal(false);
  return (
    <Fragment>
      <a
        href={'#'}
        className={theme === SupportedTheme.LIGHT ? 'alert-light' : 'alert-dark'}
        style={triggerStyle}
        onClick={(): void => setShowModal(true)}>
        {t('About')}
      </a>
      <Modal show={showModal} onHide={hideLicenseDisclosure} centered size={'xl'}>
        <Modal.Header closeButton>
          <Modal.Title>{t('About')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p onClick={openDevTool}>
            {t('Version')} {version}
          </p>
          <h5>Open-Source Licenses</h5>
          <Table>
            <thead>
              <tr>
                <th className={'border-top-0'}>{t('Name')}</th>
                <th className={'border-top-0'}>{t('License')}</th>
                <th className={'border-top-0'}>{t('Details')}</th>
              </tr>
            </thead>
            <tbody>
              {LICENSES.map((licenseInfo, i) => {
                const { name, license } = licenseInfo;
                return (
                  <tr key={i}>
                    <td>{name}</td>
                    <td>{license}</td>
                    <td>
                      <LicenseDetails {...licenseInfo} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
    </Fragment>
  );
};

export default LicenseDisclosure;
