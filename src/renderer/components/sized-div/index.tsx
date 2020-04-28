import React, { FC } from 'react';

interface SizedDivProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  width?: number;
  height?: number;
}

const SizedDiv: FC<SizedDivProps> = (props) => {
  const { width, height, style = {}, ...restProps } = props;
  if (typeof width === 'number') {
    const widthWithUnit = `${width}vw`;
    style.width = widthWithUnit;
    style.maxWidth = widthWithUnit;
    style.overflowX = 'auto';
  }
  if (typeof height === 'number') {
    const heightWithUnit = `${height}vw`;
    style.height = heightWithUnit;
    style.maxHeight = heightWithUnit;
    style.overflowY = 'auto';
  }

  return (
    <div {...restProps} style={style}>
      {props.children}
    </div>
  );
};

export default SizedDiv;
