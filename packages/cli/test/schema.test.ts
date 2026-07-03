import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSchemas, writeSchemas } from '../src/commands/schema.js';

// `jorvel schema` now RE-SOURCES the authoritative schemas from @jorvel/types
// rather than hand-building a second (contradictory) set.

describe('buildSchemas', () => {
  it('emits the three authoritative schemas re-sourced from @jorvel/types', () => {
    const cat = buildSchemas();
    expect(Object.keys(cat).sort()).toEqual(['jorvel.app', 'jorvel.config', 'jorvel.federation']);
  });

  it('app schema requires name + type + port (the REAL shape, not the old `kind`)', () => {
    const cat = buildSchemas();
    const app = cat['jorvel.app']!;
    expect(app.required).toEqual(['name', 'type', 'port']);
    // The old hand-written schema used `kind`; the authoritative one uses `type`.
    expect((app.properties as Record<string, unknown>)['type']).toBeDefined();
    expect((app.properties as Record<string, unknown>)['kind']).toBeUndefined();
  });

  it('config schema matches the file @jorvel/types ships (same $id)', () => {
    const cat = buildSchemas();
    expect(cat['jorvel.config']!.$id).toBe('https://jorveljs.vercel.app/schemas/jorvel.config.json');
  });
});

describe('writeSchemas', () => {
  it('writes pretty-printed schemas to disk with trailing newline', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      const { files } = writeSchemas({ outDir: tmp });
      expect(files).toHaveLength(3);
      const content = fs.readFileSync(path.join(tmp, 'jorvel.config.json'), 'utf8');
      expect(content.endsWith('\n')).toBe(true);
      expect(content).toContain('"title": "JORVEL Workspace Config"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('honors pretty=false (no indent)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      writeSchemas({ outDir: tmp, pretty: false });
      const raw = fs.readFileSync(path.join(tmp, 'jorvel.app.json'), 'utf8');
      expect(raw).not.toMatch(/\n  "/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('creates the output directory if missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      const nested = path.join(tmp, 'nested', 'dir');
      writeSchemas({ outDir: nested });
      expect(fs.existsSync(path.join(nested, 'jorvel.config.json'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('accepts a custom catalog override (testing)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      const result = writeSchemas({
        outDir: tmp,
        catalog: { stub: { $id: 'x', title: 't', type: 'object', properties: {} } },
      });
      expect(result.files).toHaveLength(1);
      expect(result.files[0]!.name).toBe('stub');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
