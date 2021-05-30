export const ensureLF = (str: string): string => {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

/**
 * Capitalizes the first letter of a string.
 */
export const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toLocaleUpperCase() + str.slice(1);
};
