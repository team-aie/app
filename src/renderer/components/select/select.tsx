import React, { FC } from 'react';
import Form from 'react-bootstrap/Form';
import { FormControlProps } from 'react-bootstrap/FormControl';

interface StrictSelectProps {
  value: string | number;
  /**
   * Used to allow this element to be selected in react-testing-library testing
   */
  testId?: string;
}

type SelectProps = StrictSelectProps &
  Omit<React.ComponentProps<typeof Form>, 'onChange'> &
  Pick<FormControlProps, 'onChange'>;

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
