import { figure, list, note, p, section, steps, terms, type GameRules } from '../../shared/rules';
import { Blocks } from './ui/ruleFigures';
import { MAX_EDITS } from './engine';
import { D, H, W } from './world';

const MAX_EDITS_TEXT = MAX_EDITS.toLocaleString('en-US');

export const BLOCKYARD_RULES: GameRules = {
  title: 'Blockyard',
  variants: [
    {
      id: 'standard',
      label: 'Standard',
      book: {
        summary: 'A 3D world made of blocks. Walk, fly, break blocks and place new ones. There are no turns and no winner: build whatever you like, alone or with up to 7 friends in the same world.',
        sections: [
          section(
            'What it is',
            p(`Blockyard is a sandbox: a generated world of ${W} × ${D} columns, ${H} blocks high, with hills, trees, water and caves. There is nothing to win; you build.`),
            list('**On this device**, your world is saved in the browser as you build, and comes back the next time you open Blockyard.', '**Online**, everyone at the table shares one world and sees each other move and build live.'),
          ),
          section(
            'Getting started',
            steps('Click the world to take control. The mouse now turns your view.', 'Press **Esc** to get the mouse back (for example to use the sidebar).'),
            note('Blockyard needs a keyboard and a mouse; it does not play on touch screens.'),
          ),
          section(
            'Moving',
            terms(
              ['W A S D or arrows', 'Walk forward, left, back, right.'],
              ['Space', 'Jump. While flying, rise.'],
              ['Shift', 'While flying, sink.'],
              ['Shift or Ctrl (on the ground)', 'Run.'],
              ['F, or Space twice quickly', 'Start or stop flying.'],
            ),
          ),
          section(
            'Building',
            figure(Blocks),
            steps(
              'Look at a block within reach (about six blocks away). It is outlined.',
              '**Left click** breaks it. The bottom layer (bedrock) cannot be broken.',
              '**Right click** places the block in your selected hotbar slot against the face you are looking at. You cannot place a solid block where you are standing.',
              '**1 to 9** pick a hotbar slot; the mouse wheel moves between slots.',
              '**E** opens every block type: choose one for the selected slot.',
              '**Middle click** copies the block you are looking at into the selected slot.',
            ),
          ),
          section(
            'Limits',
            list(
              `A world keeps up to ${MAX_EDITS_TEXT} changed blocks. After that, it stops accepting changes.`,
              'Online, up to 8 builders share a world. Each builder\'s placed and broken blocks are counted in the sidebar.',
              'On this device, New world throws away your saved world and makes a fresh one.',
            ),
          ),
        ],
      },
    },
  ],
};
