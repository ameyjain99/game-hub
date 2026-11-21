import type { ReactNode } from 'react';

/** One of a game's options, as a choice between named values. */
export interface OptionField {
  key: string;
  label: string;
  choices: { value: string | number | boolean; label: string }[];
}

/** What the lobby shows about a room's rules: a line per option for everyone, and (for the host) the controls to change them. */
export interface LobbyRulesView {
  summary: string[];
  editor?: ReactNode;
}

/** How a game describes its options to the lobby; `onChange` is null for a guest (read only). */
export type RulesFor = (options: unknown, onChange: ((options: unknown) => void) | null) => LobbyRulesView;

/** The lobby view for a game whose options are plain choices. */
export function rulesFromSpec(spec: OptionField[]): RulesFor {
  return (options, onChange) => {
    const value = (options ?? {}) as Record<string, unknown>;
    const chosen = (f: OptionField) => f.choices.find((c) => c.value === value[f.key]) ?? f.choices[0];
    return {
      summary: spec.map((f) => `${f.label}: ${chosen(f).label}`),
      editor: onChange ? (
        <>
          {spec.map((f) => (
            <label key={f.key} className="g-field">
              <span className="g-field-label">{f.label}</span>
              <select
                aria-label={f.label}
                value={f.choices.indexOf(chosen(f))}
                onChange={(e) => onChange({ ...value, [f.key]: f.choices[Number(e.target.value)].value })}
              >
                {f.choices.map((c, i) => (
                  <option key={String(c.value)} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </>
      ) : undefined,
    };
  };
}
