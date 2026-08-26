import { TestBed } from '@angular/core/testing';
import { ContentService } from '@pc/core';
import { getPath, setPath } from '@pc/core';
import { SECTIONS, SECTION_BY_ID } from '@pc/core';
import { EditorDraft } from '@pc/core';

describe('ContentService', () => {
  let content: ContentService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    content = TestBed.inject(ContentService);
  });

  afterEach(() => localStorage.clear());

  it('starts from the bundled content and reports it as clean', () => {
    expect(content.profile().name).toBeTruthy();
    expect(content.skillGroups().length).toBeGreaterThan(0);
    expect(content.dirty()).toBeFalse();
  });

  it('adds, updates, reorders and removes list entries', () => {
    const before = content.services().length;

    content.add('services', { title: 'Added', icon: 'zap', copy: 'Test' });
    expect(content.services().length).toBe(before + 1);
    expect(content.services().at(-1)?.title).toBe('Added');

    content.update('services', before, { title: 'Renamed', icon: 'zap', copy: 'Test' });
    expect(content.services().at(-1)?.title).toBe('Renamed');

    content.move('services', before, -1);
    expect(content.services()[before - 1].title).toBe('Renamed');

    content.remove('services', before - 1);
    expect(content.services().length).toBe(before);
    expect(content.services().some((service) => service.title === 'Renamed')).toBeFalse();
  });

  it('refuses to move an entry off either end of the list', () => {
    const first = content.projects()[0].title;
    content.move('projects', 0, -1);
    expect(content.projects()[0].title).toBe(first);

    const lastIndex = content.projects().length - 1;
    const last = content.projects()[lastIndex].title;
    content.move('projects', lastIndex, 1);
    expect(content.projects()[lastIndex].title).toBe(last);
  });

  it('patches one branch without touching the rest', () => {
    const skills = content.skillGroups().length;
    content.patch('education', { ...content.education(), degree: 'MSc' });

    expect(content.education().degree).toBe('MSc');
    expect(content.skillGroups().length).toBe(skills);
    expect(content.dirty()).toBeTrue();
  });

  it('round-trips through export and import', () => {
    content.patch('profile', { ...content.profile(), role: 'Staff Engineer' });
    const exported = content.serialise();

    content.patch('profile', { ...content.profile(), role: 'Something else' });
    content.import(exported);

    expect(content.profile().role).toBe('Staff Engineer');
  });

  it('rejects a file that is not portfolio content', () => {
    expect(() => content.import('{"nope":1}')).toThrowError(/portfolio content/);
    expect(() => content.import('not json at all')).toThrow();
  });

  it('fills missing branches when importing an older file', () => {
    content.import(JSON.stringify({ profile: content.profile() }));

    expect(content.skillGroups().length).toBeGreaterThan(0);
    expect(content.projects().length).toBeGreaterThan(0);
  });

  it('restores local edits on the next load and drops them on reset', async () => {
    content.patch('profile', { ...content.profile(), name: 'Edited Name' });

    const restored = TestBed.inject(ContentService);
    await restored.load();
    expect(restored.profile().name).toBe('Edited Name');

    await restored.reset();
    expect(restored.profile().name).not.toBe('Edited Name');
    expect(restored.dirty()).toBeFalse();
  });
});

describe('dotted paths', () => {
  it('reads and writes nested keys and array slots', () => {
    const item = { keyProject: { title: 'A', points: ['x'] }, accent: ['#111', '#222'] };

    expect(getPath(item, 'keyProject.title')).toBe('A');
    expect(getPath(item, 'accent.1')).toBe('#222');
    expect(getPath(item, 'missing.deep')).toBeUndefined();

    const next = setPath(item, 'keyProject.title', 'B');
    expect(getPath(next, 'keyProject.title')).toBe('B');
    // The source object is left alone.
    expect(item.keyProject.title).toBe('A');

    expect(getPath(setPath(item, 'accent.0', '#fff'), 'accent.0')).toBe('#fff');
    expect(getPath(setPath({}, 'a.b.c', 1), 'a.b.c')).toBe(1);
    expect(getPath(setPath({}, 'list.0', 'first'), 'list.0')).toBe('first');
  });
});

describe('EditorDraft', () => {
  const fields = SECTION_BY_ID.get('experience')!.fields;

  it('flattens dotted fields in and folds them back out', () => {
    const draft = new EditorDraft(fields);
    draft.load({
      company: 'Acme',
      role: 'Dev',
      points: ['a'],
      keyProject: { title: 'Thing', points: ['p'] },
    });

    expect(draft.valueOf('keyProject.title')).toBe('Thing');
    expect(draft.pristine()).toBeTrue();

    draft.set('keyProject.title', 'Other');
    expect(draft.pristine()).toBeFalse();

    const built = draft.build<{ keyProject: { title: string }; company: string }>();
    expect(built.keyProject.title).toBe('Other');
    // Untouched keys survive the round trip.
    expect(built.company).toBe('Acme');
  });

  it('reports required fields that are still empty', () => {
    const draft = new EditorDraft(fields);
    draft.load({ company: '', role: '', points: [] });

    expect(draft.valid()).toBeFalse();
    expect(draft.missing().map((field) => field.key)).toContain('company');

    draft.set('company', 'Acme');
    draft.set('role', 'Dev');
    draft.set('points', ['something']);
    expect(draft.valid()).toBeTrue();
  });
});

describe('content schema', () => {
  it('points every section at a real content branch', () => {
    const content = TestBed.inject(ContentService).content() as unknown as Record<string, unknown>;

    for (const section of SECTIONS) {
      if (section.key === '') {
        continue;
      }

      expect(content[section.key])
        .withContext(`section ${section.id} -> ${section.key}`)
        .toBeDefined();
    }
  });

  it('gives every list section a blank template covering its required fields', () => {
    for (const section of SECTIONS.filter((entry) => entry.kind === 'list')) {
      expect(section.blank).withContext(`${section.id} has no blank`).toBeDefined();

      for (const field of section.fields.filter((entry) => entry.required)) {
        // Only top-level keys are seeded; nested ones are created on save.
        if (!field.key.includes('.')) {
          expect(Object.keys(section.blank ?? {}))
            .withContext(`${section.id} blank is missing ${field.key}`)
            .toContain(field.key);
        }
      }
    }
  });
});
