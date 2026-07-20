/**
 * Type definitions for BaseCD
 * Specification: docs/SPECIFICATION.md
 */

export type BaseCDInput = string | Uint8Array | Buffer | number[];

export type BaseCDErrorCode =
  | 'INVALID_INPUT_TYPE'
  | 'MALFORMED_STRING'
  | 'INVALID_SYMBOL'
  | 'INVALID_PADDING'
  | 'CHECKSUM_MISMATCH';

export class BaseCDError extends Error {
  readonly name: 'BaseCDError';
  readonly code: BaseCDErrorCode;
  constructor(message: string, code: BaseCDErrorCode);
}

/**
 * Encode data into a BaseCD string of the form "CD1-<payload>-<checksum>".
 */
export function encode(input: BaseCDInput): string;

/**
 * Decode a BaseCD string into its original bytes.
 * Throws BaseCDError if malformed or the checksum does not match.
 */
export function decode(basecdString: string): Uint8Array;

/**
 * Decode a BaseCD string into a UTF-8 string.
 */
export function decodeToString(basecdString: string): string;

/**
 * Check whether a string is structurally well-formed BaseCD.
 * Does NOT verify the checksum — see verifyChecksum().
 */
export function validate(basecdString: string): boolean;

/**
 * Check whether a BaseCD string's checksum matches its payload.
 */
export function verifyChecksum(basecdString: string): boolean;

export const ALPHABET: string;
export const VERSION_PREFIX: string;
