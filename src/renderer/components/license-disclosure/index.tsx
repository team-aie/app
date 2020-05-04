import React, { CSSProperties, FC, Fragment, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';

import LICENSES, { LicenseInfo } from '../../licenses';

type LicenseTextModalProps = LicenseInfo;

const LicenseDetails: FC<LicenseTextModalProps> = ({ name, version, author, repository, license, licenseText }) => {
  const [show, setShow] = useState(false);
  const hideDetails = (): void => setShow(false);
  return (
    <Fragment>
      <Button variant={'outline-secondary'} onClick={(): void => setShow(true)}>
        Show
      </Button>
      <Modal show={show} onHide={hideDetails} centered>
        <Modal.Body>
          <Table>
            <tbody>
              <tr>
                <td className={'border-top-0 border-right'}>Name</td>
                <td className={'border-top-0'}>{name}</td>
              </tr>
              <tr>
                <td className={'border-top-0 border-right'}>Version</td>
                <td className={'border-top-0'}>{version}</td>
              </tr>
              {author && (
                <tr>
                  <td className={'border-top-0 border-right'}>Author</td>
                  <td className={'border-top-0'}>{author}</td>
                </tr>
              )}
              {repository && (
                <tr>
                  <td className={'border-top-0 border-right'}>Repository</td>
                  <td className={'border-top-0'}>{repository}</td>
                </tr>
              )}
              <tr>
                <td className={'border-top-0 border-right'}>License</td>
                <td className={'border-top-0'}>{license}</td>
              </tr>
              <tr>
                <td className={'border-top-0 border-right'}>License Text</td>
                <td className={'border-top-0'}>{licenseText}</td>
              </tr>
            </tbody>
          </Table>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={hideDetails} variant={'outline-success'}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Fragment>
  );
};

const LicenseDisclosure: FC<{ triggerStyle?: CSSProperties }> = ({ triggerStyle }) => {
  const [showModal, setShowModal] = useState(false);
  const hideLicenseDisclosure = (): void => setShowModal(false);
  return (
    <Fragment>
      <a href={'#'} className={'alert-light'} style={triggerStyle} onClick={(): void => setShowModal(true)}>
        Open-Source Licenses
      </a>
      <Modal show={showModal} onHide={hideLicenseDisclosure} centered size={'xl'}>
        <Modal.Header closeButton>
          <Modal.Title>Open-Source Licenses</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table>
            <thead>
              <tr>
                <th className={'border-top-0'}>Name</th>
                <th className={'border-top-0'}>License</th>
                <th className={'border-top-0'}>Details</th>
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
