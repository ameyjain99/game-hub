/**
 * Single source of truth for the icons that recur across screens, so swapping
 * the icon set (or a specific glyph) is a one-line change here. One-off icons
 * (mute, crown, mic/cam, etc.) are imported from lucide-react directly at their
 * use site.
 */
import { ChevronLeft, ExternalLink, X, Check, Star, Plus, Copy } from 'lucide-react';

// Recurring icons under semantic names.
export const BackIcon = ChevronLeft;
export const ExternalLinkIcon = ExternalLink;
export const CloseIcon = X; // close / leave / dismiss / remove
export const TicketDoneIcon = Check;
export const TicketFailIcon = X;
export const LocoIcon = Star; // the wild locomotive card mark
export const SafeSquareIcon = Star; // Ludo's safe star squares
export const AddIcon = Plus; // add player / add AI
export const CopyIcon = Copy; // copy to clipboard
export const CheckIcon = Check; // confirmed / copied

// One-off icons re-exported so no other file imports lucide-react directly.
export {
  BookOpen,
  Volume2,
  VolumeX,
  Crown,
  Mic,
  MicOff,
  AlertTriangle,
  User,
  Video,
  VideoOff,
  Circle,
  // Monopoly board + cockpit
  TrainFront,
  Lightbulb,
  Droplets,
  Receipt,
  Gem,
  CircleHelp,
  Gift,
  ArrowLeft,
  Lock,
  Car,
  Siren,
  House,
  Hotel,
  Minus,
  Landmark,
  ArrowLeftRight,
  Gavel,
  // Cluedo
  Search,
  DoorOpen,
  // Last Card, Wordgrid
  Ban,
  Repeat2,
  FlipVertical2,
  Megaphone,
  Shuffle,
  Undo2,
} from 'lucide-react';
