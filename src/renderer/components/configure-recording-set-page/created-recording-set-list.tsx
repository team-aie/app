import React, { CSSProperties, FC, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Image from 'react-bootstrap/Image';
import ListGroup from 'react-bootstrap/ListGroup';
import Row from 'react-bootstrap/Row';

import { Consumer, RecordingSet } from '../../types';
import { filename, naiveSerialize } from '../../utils';

import deleteButton from './delete-button.svg';

interface CreatedRecordingSetListItemProps {
  recordingSet: RecordingSet;
  recordingSetStr: string;
  removeRecordingSet: Consumer<RecordingSet>;
  selected: boolean;
  setSelectedRecordingSetIndex: Consumer<number>;
  index: number;
}

const CreatedRecordingSetListItem: FC<CreatedRecordingSetListItemProps> = ({
  recordingSet,
  recordingSetStr,
  removeRecordingSet,
  selected,
  setSelectedRecordingSetIndex,
  index,
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <Container
      fluid={true}
      style={hovered || selected ? { filter: 'invert(1)', textDecoration: 'underline' } : undefined}
      onMouseEnter={(): void => setHovered(true)}
      onMouseLeave={(): void => setHovered(false)}
      onClick={(): void => {
        if (!selected) {
          setSelectedRecordingSetIndex(index);
        }
      }}>
      <Row>
        <Col className={'text-truncate'} style={{ maxWidth: '100%' }}>
          {recordingSetStr}
        </Col>
        <Col xs={'auto'} sm={'auto'} md={'auto'} lg={'auto'} xl={'auto'}>
          <Image
            src={deleteButton}
            style={{ width: '1rem' }}
            onClick={(e): void => {
              e.stopPropagation();
              removeRecordingSet(recordingSet);
            }}
          />
        </Col>
      </Row>
    </Container>
  );
};

interface CreatedRecordingSetListProps {
  recordingSets: RecordingSet[];
  removeRecordingSet: Consumer<RecordingSet>;
  selectedRecordingSetIndex: number;
  setSelectedRecordingSetIndex: Consumer<number>;
  minListLength?: number;
  style?: CSSProperties;
}

const CreatedRecordingSetList: FC<CreatedRecordingSetListProps> = ({
  recordingSets,
  removeRecordingSet,
  selectedRecordingSetIndex,
  setSelectedRecordingSetIndex,
  minListLength = 4,
  style,
}) => {
  const recordingSetsToDisplay: (RecordingSet | undefined)[] =
    recordingSets.length >= minListLength ? recordingSets : [...Array(minListLength)].map((x, i) => recordingSets[i]);
  const recordingSetStrings: [RecordingSet | undefined, string][] = recordingSetsToDisplay.map((recordingSet) => {
    if (recordingSet) {
      const {
        name,
        scale: { key, octave },
        recordingList,
      } = recordingSet;
      const listStr = recordingList.type === 'built-in' ? recordingList.name : filename(recordingList.filePath);
      return [recordingSet, `<${name}> - ${key}${octave} - ${listStr}`];
    } else {
      return [recordingSet, ''];
    }
  });

  return (
    <ListGroup style={style}>
      {recordingSetStrings.map(([recordingSet, recordingSetStr], i) => (
        <ListGroup.Item
          key={naiveSerialize(recordingSet || i)}
          className={'border-top-0 border-right-0 border-bottom border-left-0 rounded-0'}>
          {recordingSet && (
            <CreatedRecordingSetListItem
              recordingSet={recordingSet}
              recordingSetStr={recordingSetStr}
              index={i}
              removeRecordingSet={removeRecordingSet}
              selected={recordingSets[selectedRecordingSetIndex] === recordingSet}
              setSelectedRecordingSetIndex={setSelectedRecordingSetIndex}
            />
          )}
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default CreatedRecordingSetList;
