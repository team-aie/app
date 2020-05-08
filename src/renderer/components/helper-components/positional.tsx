import React, { CSSProperties, FC } from 'react';
import Container, { ContainerProps } from 'react-bootstrap/Container';

type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-center'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-center';

type CssPositionKeywords = 'top' | 'right' | 'bottom' | 'left';

const POSITION_MAP: { [k in Position]: CssPositionKeywords[] } = {
  'top-left': ['top', 'left'],
  'top-center': ['top'],
  'top-right': ['top', 'right'],
  'right-center': ['right'],
  'bottom-right': ['bottom', 'right'],
  'bottom-center': ['bottom'],
  'bottom-left': ['bottom', 'left'],
  'left-center': ['left'],
};

const CLASS_NAME_MAP: { [k in Position]: FlexRelatedClassNames[] } = {
  'top-left': ['justify-content-start', 'align-items-center'],
  'top-center': ['justify-content-center', 'align-items-center'],
  'top-right': ['justify-content-end', 'align-items-center'],
  'right-center': ['justify-content-end', 'align-items-center', 'w-auto', 'h-100'],
  'bottom-right': ['justify-content-end', 'align-items-center'],
  'bottom-center': ['justify-content-center', 'align-items-center'],
  'bottom-left': ['justify-content-start', 'align-items-center'],
  'left-center': ['justify-content-start', 'align-items-center', 'w-auto', 'h-100'],
};

type FlexRelatedClassNames =
  | 'justify-content-start'
  | 'justify-content-center'
  | 'justify-content-end'
  | 'align-items-center'
  | 'w-auto'
  | 'h-100';

const DISTANCE_FROM_EDGE = '1.5rem';

interface StrictPositionalProps {
  position: Position;
  className?: string;
  style?: CSSProperties;
}

interface PositionalProps extends StrictPositionalProps, ContainerProps {
  [k: string]: unknown;
}

export const Positional: FC<PositionalProps> = ({ children, position, className = '', style = {}, ...props }) => {
  const positionStyle = Object.fromEntries(POSITION_MAP[position].map((x) => [x, DISTANCE_FROM_EDGE]));
  const classes = CLASS_NAME_MAP[position].join(' ');
  return (
    <Container
      fluid={position === 'top-center' || position === 'bottom-center'}
      className={`position-absolute p-0 d-flex ${classes} ${className}`.trim()}
      style={{ ...positionStyle, ...style }}
      {...props}>
      {children}
    </Container>
  );
};
