import Ajv from 'ajv';
import schema from '../src/plugin-index.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema as any);

describe('plugin-index.schema.json', () => {
  it('accepts minimal valid object', () => {
    const data = { packages: [{ id: 'a', name: 'A' }] };
    expect(validate(data)).toBe(true);
  });
  it('accepts extra top-level fields', () => {
    const data = {
      generatedAt: '2025-10-06T00:00:00Z',
      version: '1.2.3',
      packages: [{ id: 'a', name: 'A' }],
    } as any;
    expect(validate(data)).toBe(true);
  });
  it('accepts jurisdiction as array of strings', () => {
    const data = {
      packages: [
        { id: 'a', name: 'A', jurisdiction: ['Global'] },
        { id: 'b', name: 'B', jurisdiction: [] },
      ],
    } as any;
    expect(validate(data)).toBe(true);
  });
  it('rejects missing packages', () => {
    expect(validate({} as any)).toBe(false);
  });
  it('rejects package missing id', () => {
    const ok = validate({ packages: [{ name: 'X' }] });
    expect(ok).toBe(false);
  });
});
