export const ensureLF = (str: string): string => {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};
