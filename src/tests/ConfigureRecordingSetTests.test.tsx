/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from 'react-dom';
import { act } from 'react-dom/test-utils';

import ConfigureRecordingSetPage from '../renderer/components/configure-recording-set-page/index';
import showDetailButton from '../renderer/components/configure-recording-set-page/show-detail.svg';
import ImageButton from '../renderer/components/image-button';
import { RecordingSet } from '../renderer/types';

describe('configureRecordingSetPage', () => {
  // eslint-disable-next-line jest/prefer-expect-assertions
  it('renders without showDetails button', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
      render(
        <ConfigureRecordingSetPage
          onNext={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
          onBack={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {}}
          onSetSelected={(consumer: RecordingSet) => {}}
        />,
        container,
      );
    });
    expect(container).not.toContain(<ImageButton src={showDetailButton} width={'7rem'} />);
  });
});
