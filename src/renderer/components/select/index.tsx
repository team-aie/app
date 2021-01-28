import React, { CSSProperties, FC } from 'react';
import Form from 'react-bootstrap/Form';

interface StrictSelectProps {
  value: string | number;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  testId?: string; // Used to allow this element to be selected in react-testing-library testing
}

// FIXME: The following didn't work, so adding properties on an ad-hoc basis
// type SelectProps = StrictSelectProps & React.HTMLProps<Form>;
interface SelectProps extends StrictSelectProps {
  className?: string;
  style?: CSSProperties;
}

export const Select: FC<SelectProps> = ({ value, onChange, testId = '', children, ...outerProps }) => {
  return (
    <Form {...outerProps}>
      <Form.Group>
        <Form.Control
          as={'select'}
          className={'border-top-0 border-right-0 border-left-0 rounded-0'}
          data-testid={testId}
          value={value}
          onChange={onChange}>
          {children}
        </Form.Control>
      </Form.Group>
    </Form>
  );
};
