import { analyse } from 'chardet';
import { Match } from 'chardet/lib/match';
import log from 'electron-log';

abstract class BestEffortDecoder<ResultType> {
  abstract name: string;

  public async decode(buffer: Buffer): Promise<string> {
    const results = await this.analyze(buffer);
    log.info(`Charset detection results`, results);
    const mostConfidentEncoding = this.findEncodingToAttempt(results);
    if (!mostConfidentEncoding) {
      throw new Error(`Failed to detect encoding for file`);
    }

    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(mostConfidentEncoding, { fatal: true });
    } catch (e) {
      const message = `Error when creating decoder`;
      log.error(message, e);
      throw new Error(`${message}: ${e}`);
    }

    let decoded: string;
    try {
      decoded = decoder.decode(buffer);
    } catch (e) {
      const message = `Error when decoding file content`;
      log.error(message, e);
      throw new Error(`${message}: ${e}`);
    }

    return decoded;
  }

  protected abstract analyze(buffer: Buffer): Promise<ResultType>;
  protected abstract findEncodingToAttempt(result: ResultType): string | null | undefined;
}

class ChardetDecoder extends BestEffortDecoder<Match[]> {
  name: 'chardet' = 'chardet';

  protected async analyze(buffer: Buffer): Promise<Match[]> {
    return analyse(buffer);
  }

  protected findEncodingToAttempt(result: Match[]): string {
    return result[0] && result[0].name;
  }
}

const BUFFER_DECODERS_IN_ORDER = [new ChardetDecoder()];

export const bestEffortDecode = async (buffer: Buffer): Promise<string> => {
  for (const decoder of BUFFER_DECODERS_IN_ORDER) {
    try {
      return await decoder.decode(buffer);
    } catch (e) {
      log.warn(`Failed to decode buffer using ${decoder.name}`, e);
    }
  }
  throw new Error(`Failed to decode buffer`);
};

export default BUFFER_DECODERS_IN_ORDER;
