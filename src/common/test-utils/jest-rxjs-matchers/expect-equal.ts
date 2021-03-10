import CustomMatcherResult = jest.CustomMatcherResult;
import MatcherHintOptions = jest.MatcherHintOptions;
import MatcherContext = jest.MatcherContext;

/**
 * Mostly copied from the `toEqual()` matcher.
 */
export const expectEqual = <T>(
  matcher: MatcherContext,
  matcherName: string,
  received: T,
  expected: T,
): CustomMatcherResult => {
  const {
    equals,
    expand,
    utils: { matcherHint, printExpected, printReceived, diff },
  } = matcher;
  const pass = equals(received, expected);

  const options: MatcherHintOptions = {
    isNot: matcher.isNot,
  };

  const message = pass
    ? () =>
        matcherHint(`.${matcherName}`, undefined, undefined, options) +
        '\n\n' +
        `Expected: ${printExpected(expected)}\n` +
        `Received: ${printReceived(received)}`
    : () => {
        const difference = diff(expected, received, { expand });

        return (
          matcherHint(`.${matcherName}`, undefined, undefined, options) +
          '\n\n' +
          (difference && difference.includes('- Expect')
            ? `Difference:\n\n${difference}`
            : `Expected: ${printExpected(expected)}\n` + `Received: ${printReceived(received)}`)
        );
      };

  // Passing the actual and expected objects so that a custom reporter
  // could access them, for example in order to display a custom visual diff,
  // or create a different error message
  return { pass, message };
};
