import { toWhatsAppNumber, waLink } from '../src/common/utils/phone';

/**
 * A guest types their number half a dozen ways. All of them must resolve to the
 * one WhatsApp identity, or confirmations go to a number that doesn't exist.
 */
describe('toWhatsAppNumber', () => {
  it.each([
    ['08077125775', '2348077125775', 'local with trunk 0'],
    ['0807 712 5775', '2348077125775', 'local, spaced'],
    ['0807-712-5775', '2348077125775', 'local, hyphenated'],
    ['+2348077125775', '2348077125775', 'E.164 with +'],
    ['2348077125775', '2348077125775', 'E.164 without +'],
    ['+234 807 712 5775', '2348077125775', 'E.164 spaced'],
    ['8077125775', '2348077125775', 'bare national'],
    ['002348077125775', '2348077125775', '00 international prefix'],
  ])('%s -> %s (%s)', (input, expected) => {
    expect(toWhatsAppNumber(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    [null, 'null'],
    [undefined, 'undefined'],
    ['abc', 'no digits'],
    ['123', 'too short to be a line'],
  ] as [string | null | undefined, string][])('rejects %s (%s)', (input) => {
    expect(toWhatsAppNumber(input)).toBeNull();
  });

  it('honours a non-Nigerian country code', () => {
    expect(toWhatsAppNumber('07700 900123', '44')).toBe('447700900123');
  });

  it('builds a wa.me link with the message url-encoded', () => {
    const link = waLink('2348077125775', 'Room 101 & breakfast');
    expect(link).toBe('https://wa.me/2348077125775?text=Room%20101%20%26%20breakfast');
  });
});
