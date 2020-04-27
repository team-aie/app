import React, { FC } from 'react';
import { Button, Modal, Table } from 'semantic-ui-react';

import LICENSES from '../../licenses';

const LicenseDisclosure: FC = () => {
  return (
    <Modal trigger={<Button secondary>Open-Source Licenses</Button>} basic size="small">
      <Modal.Content>
        <Table celled padded>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Version</Table.HeaderCell>
              <Table.HeaderCell>Author</Table.HeaderCell>
              <Table.HeaderCell>Repository</Table.HeaderCell>
              <Table.HeaderCell>License</Table.HeaderCell>
              <Table.HeaderCell>License Text</Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {LICENSES.map(({ name, version, author, repository, license, licenseText }, i) => (
              <Table.Row key={i}>
                <Table.Cell>{name}</Table.Cell>
                <Table.Cell>{version}</Table.Cell>
                <Table.Cell>{author}</Table.Cell>
                <Table.Cell>{repository}</Table.Cell>
                <Table.Cell>{license}</Table.Cell>
                <Table.Cell>
                  <Modal size="small" trigger={<Button primary>Show License</Button>}>
                    <Modal.Header>License Text</Modal.Header>
                    <Modal.Content>{licenseText}</Modal.Content>
                  </Modal>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Modal.Content>
    </Modal>
  );
};

export default LicenseDisclosure;
