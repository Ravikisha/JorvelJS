import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Press kit',
  description: 'JORVEL logos, colors, and usage guidelines. Download the marks.',
};

const ASSETS = [
  { label: 'Icon / app mark (PNG)', file: '/logojorvel.png' },
  { label: 'Wordmark (light backgrounds)', file: '/jorvel-logo-light.svg' },
  { label: 'Wordmark (dark backgrounds)', file: '/jorvel-logo-dark.svg' },
];

const COLORS = [
  { name: 'Indigo (primary)', hex: '#6366f1' },
  { name: 'Ink', hex: '#0a0a0a' },
  { name: 'Paper', hex: '#ffffff' },
];

export default function Press() {
  return (
    <>
      <h1>Press kit</h1>
      <p>Logos, colors, and usage rules for writing about or integrating JORVEL.</p>

      <h2 id="logos">Logos</h2>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {ASSETS.map((a) => (
          <div key={a.file} style={{ border: '1px solid var(--border,#e5e7eb)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 80, background: a.file.includes('dark') ? '#0a0a0a' : 'transparent', borderRadius: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.file} alt={a.label} style={{ maxHeight: 56, maxWidth: '100%' }} />
            </div>
            <p style={{ margin: '10px 0 4px', fontWeight: 600 }}>{a.label}</p>
            <a href={a.file} download>Download SVG</a>
          </div>
        ))}
      </div>

      <h2 id="colors">Colors</h2>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {COLORS.map((c) => (
          <div key={c.hex} style={{ width: 140 }}>
            <div style={{ height: 56, borderRadius: 8, background: c.hex, border: '1px solid rgba(0,0,0,.1)' }} />
            <p style={{ margin: '6px 0 0', fontWeight: 600 }}>{c.name}</p>
            <code>{c.hex}</code>
          </div>
        ))}
      </div>

      <h2 id="usage">Usage</h2>
      <ul>
        <li>Keep clear space around the logo equal to the height of the mark.</li>
        <li>Use the light logo on dark backgrounds and vice-versa; don&apos;t place the dark logo on a dark surface.</li>
        <li>Don&apos;t recolor, stretch, rotate, add shadows, or reconstruct the wordmark in another typeface.</li>
        <li>Write the name as <strong>JORVEL</strong> (all caps) in headings; “Jorvel” in prose is fine.</li>
      </ul>

      <Callout variant="info" title="Need something else?">
        Ask in <a href="https://github.com/Ravikisha/JorvelJS/discussions">Discussions</a> for
        additional formats (PNG, monochrome, favicon set).
      </Callout>
    </>
  );
}
