function sum(a: number, b: number): number {
  return a + b;
}

describe('dummy test', () => {
  it('adds 1 + 2 to equal 3', () => {
    expect.hasAssertions();
    expect(sum(1, 2)).toBe(3);
  });
});
