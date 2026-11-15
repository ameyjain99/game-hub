/**
 * Imposter's word list: twelve categories of ten words, twelve clues each. The words come in
 * pairs of close neighbours (Lion and Tiger, Pancake and Waffle) so Decoy mode
 * can hand the imposter the other half of the pair. Each word carries the clue
 * words that fit it; the bots give clues from these lists and read other
 * players' clues against them. `general` are clues that fit the whole category.
 */
export interface Word {
  word: string;
  clues: string[];
}

export interface Category {
  id: string;
  name: string;
  general: string[];
  pairs: [Word, Word][];
}

type PairSpec = [string, string, string, string];

const cat = (id: string, name: string, general: string, pairs: PairSpec[]): Category => ({
  id,
  name,
  general: general.split(' '),
  pairs: pairs.map(([a, ca, b, cb]) => [
    { word: a, clues: ca.split(' ') },
    { word: b, clues: cb.split(' ') },
  ]),
});

export const CATEGORIES: Category[] = [
  cat('food', 'Food', 'tasty meal kitchen plate dinner cook hungry', [
    ['Pizza', 'slice cheese oven pepperoni delivery crust italian toppings box mozzarella margherita takeaway', 'Burger', 'bun patty grill fries beef ketchup lettuce fastfood pickles bacon diner sesame'],
    ['Pancake', 'syrup flip stack breakfast batter butter fluffy tuesday lemon griddle maple crepe', 'Waffle', 'syrup grid breakfast iron crispy squares belgian cone maple whipped cream pockets'],
    ['Taco', 'shell tortilla salsa mexican crunchy beef guacamole tuesday spicy lime fiesta cilantro', 'Burrito', 'wrap tortilla beans rice mexican foil rolled stuffed cheese sour lunch heavy'],
    ['Soup', 'bowl spoon broth tomato steam sick chicken ladle cream bread warm lentil', 'Stew', 'pot slow beef chunks hearty winter carrots irish lamb thick dumplings casserole'],
    ['Cupcake', 'frosting sprinkles birthday paper sweet icing bakery candles party mini cherry swirl', 'Muffin', 'blueberry breakfast top bakery crumbs paper morning bran chocolate chip oats coffee'],
  ]),
  cat('animals', 'Animals', 'wild fur zoo pet tail paws creature', [
    ['Lion', 'mane roar king savanna pride africa jungle cub den golden lazy circus', 'Tiger', 'stripes orange roar jungle india claws prowl bengal cub cat hunter fierce'],
    ['Dolphin', 'smart clicks fin flipper ocean playful pod dive tricks mammal grin show', 'Shark', 'fin teeth jaws ocean bite predator scary hammerhead gills attack blood fear'],
    ['Horse', 'saddle gallop hooves stable rider mane racing pony carriage neigh carrot jockey', 'Zebra', 'stripes savanna africa herd black white grassland crossing pattern stripy kenya safari'],
    ['Owl', 'night hoot wise feathers eyes barn tree wisdom talons blink nocturnal moon', 'Bat', 'night cave wings upside dark vampire echo cricket radar hanging blind fruit'],
    ['Penguin', 'ice tuxedo waddle antarctica fish cold slide emperor march colony beak huddle', 'Seal', 'ice fish flippers bark ocean whiskers clap pup rocks blubber sunbathe balance'],
  ]),
  cat('places', 'Places', 'visit building city travel crowd map trip', [
    ['Beach', 'sand waves sun towel shells swim summer bucket parasol tide sunscreen coast', 'Desert', 'sand dunes camel cactus heat dry mirage sahara oasis scorpion thirst barren'],
    ['Airport', 'gate flight luggage security boarding runway passport terminal arrivals departures delay jet', 'Station', 'platform train ticket tracks commute schedule waiting rail announcement rush underground arrivals'],
    ['Library', 'books quiet shelves borrow reading card silence novels catalogue fines study desk', 'Museum', 'exhibit paintings history tour statues ancient gallery curator dinosaur artifacts mummy guide'],
    ['Hospital', 'doctor nurse emergency beds ambulance sick ward surgeon patients stretcher visitors injury', 'Pharmacy', 'medicine pills prescription counter cough chemist bottle tablets vitamins drugstore cream queue'],
    ['Zoo', 'cages animals keeper tickets elephants feeding monkeys enclosure lions safari visitors penguins', 'Aquarium', 'tank fish glass jellyfish underwater coral sharks dolphins octopus tropical tunnel seahorse'],
  ]),
  cat('jobs', 'Jobs', 'work job career office uniform boss salary', [
    ['Doctor', 'stethoscope patient diagnosis hospital clinic prescription surgery coat appointment medicine checkup fever', 'Nurse', 'patient hospital injection care scrubs shift bandage ward caring thermometer night needle'],
    ['Teacher', 'classroom homework lessons chalk students grades school blackboard marking pupils apple ruler', 'Professor', 'lecture university students research campus tenure thesis academic doctorate seminar glasses library'],
    ['Chef', 'kitchen knife recipe restaurant hat menu taste apron sauce spatula cooking whites', 'Baker', 'bread oven flour dough early cakes rolls loaf yeast croissant pastry knead'],
    ['Pilot', 'cockpit plane captain sky runway wings uniform aviator airline landing headset altitude', 'Astronaut', 'space rocket helmet moon orbit gravity station spacesuit nasa weightless launch mars'],
    ['Farmer', 'tractor fields cows harvest barn crops rooster sheep pigs overalls wellies milking', 'Gardener', 'plants flowers hose soil rake hedge seeds lawn mower weeds shed compost'],
  ]),
  cat('sports', 'Sports', 'team ball score match win coach fans', [
    ['Football', 'goal kick pitch referee striker boots penalty soccer offside header stadium worldcup', 'Rugby', 'tackle scrum oval try muddy rough posts lineout conversion haka shoulder ruck'],
    ['Tennis', 'racket net court serve wimbledon love deuce forehand ace baseline yellow grass', 'Badminton', 'shuttlecock racket net feather smash court birdie shuttle drop light indoor clear'],
    ['Basketball', 'hoop dribble dunk court tall rebound bounce nba slam threepointer jump orange', 'Volleyball', 'net spike beach serve dig bump sand setter block rotation libero rally'],
    ['Swimming', 'pool lanes goggles stroke laps dive water freestyle butterfly backstroke medal chlorine', 'Surfing', 'waves board ocean wetsuit beach wipeout balance barrel hawaii tube longboard swell'],
    ['Golf', 'club hole putt course caddie tee birdie green fairway bunker eagle swing', 'Bowling', 'pins strike lane alley spare shoes roll gutter perfect skittles league heavy'],
  ]),
  cat('home', 'At home', 'house room furniture cozy family indoor everyday', [
    ['Pillow', 'bed soft head feathers sleep fluffy case fight cushion headrest goose plump', 'Blanket', 'warm bed cozy wool cover snuggle soft throw fleece quilt picnic knit'],
    ['Fridge', 'cold milk magnets kitchen leftovers ice freezer chill shelves fresh cool humming', 'Oven', 'hot bake roast kitchen timer door tray gas heat pie baking glove'],
    ['Mirror', 'reflection glass bathroom vanity selfie wall image makeup shiny vain cracked hallway', 'Window', 'glass view curtains open frame sunlight pane blinds sill shutter clean breeze'],
    ['Toothbrush', 'teeth paste bristles bathroom morning dentist floss electric minty cup bedtime plaque', 'Comb', 'hair teeth parting styling pocket tangles barber gel lice neat plastic flat'],
    ['Candle', 'wax flame wick light birthday scent dinner holder romantic vanilla blow church', 'Lamp', 'light bulb shade switch desk bedside glow lava reading table night shadow'],
  ]),
  cat('transport', 'Transport', 'ride travel wheels ticket journey road commute', [
    ['Bicycle', 'pedals chain helmet bell spokes ride gears tandem saddle wheelie puncture lane', 'Motorbike', 'helmet engine leather fast roar handlebars throttle harley sidecar visor revving exhaust'],
    ['Train', 'tracks carriage platform conductor steam tunnel railway express locomotive whistle sleeper freight', 'Tram', 'tracks city cables street overhead conductor stop trolley rails electric pantograph downtown'],
    ['Helicopter', 'rotor blades hover rescue landing pad noisy chopper spinning ambulance traffic rooftop', 'Plane', 'wings runway pilot flight jet takeoff clouds boarding economy cabin turbulence altitude'],
    ['Boat', 'sail harbour anchor deck waves fishing captain oar yacht row cruise sailor', 'Submarine', 'underwater periscope deep navy sonar torpedo hatch yellow crew dive pressure stealth'],
    ['Taxi', 'yellow meter driver fare city hail rank cab tip passenger night airport', 'Bus', 'stop route driver double-decker ticket school seats stops fare commuter tour coach'],
  ]),
  cat('nature', 'Nature', 'outdoors weather sky earth season planet wild', [
    ['Rain', 'umbrella drops puddle wet clouds storm grey shower drizzle monsoon wellies splash', 'Snow', 'flakes cold sledge winter ski white igloo blizzard frost shovel christmas powder'],
    ['Volcano', 'lava eruption ash magma crater smoke hot pompeii island rumble molten fiery', 'Mountain', 'peak climb summit snow hiking altitude cliff everest range rocky goat ridge'],
    ['River', 'flow bank stream bridge current boat fish rapids delta canal salmon estuary', 'Lake', 'water calm shore swim boat ducks pier pond reflection kayak geese still'],
    ['Rainbow', 'colours arc gold leprechaun sky prism seven unicorn spectrum pot bright red', 'Sunset', 'evening orange horizon dusk sky glow beach twilight romantic silhouette pink west'],
    ['Forest', 'trees woods hiking leaves deer moss campfire oak pine trail fox bear', 'Jungle', 'vines monkeys rainforest humid tigers parrots dense tarzan swamp snakes canopy explorer'],
  ]),
  cat('music', 'Music', 'song sound band notes play stage melody', [
    ['Guitar', 'strings chords strum pick rock frets acoustic electric amp riff capo plectrum', 'Violin', 'bow strings orchestra chin classical fiddle bach viola rosin tune bridge concerto'],
    ['Piano', 'keys black white grand pedal concert ivory chopin sheet tuner upright stool', 'Harp', 'strings angel pluck golden heaven elegant orchestra lyre irish cherub glissando celtic'],
    ['Drum', 'beat sticks snare rhythm loud kit pound cymbal bang marching skin tom', 'Tambourine', 'jingle shake rhythm bells hand hippie tap jangle percussion folk circle shaker'],
    ['Trumpet', 'brass valves jazz loud fanfare mouthpiece blow bugle military reveille shiny cornet', 'Saxophone', 'jazz brass reed smooth curved solo blues tenor alto nightclub smoky lounge'],
    ['Choir', 'singers church voices hymn harmony robes soprano chorus carols gospel sing practice', 'Orchestra', 'conductor symphony violins concert hall strings classical pit baton cello percussion score'],
  ]),
  cat('clothing', 'Clothing', 'wear outfit fashion wardrobe style shop size', [
    ['Scarf', 'neck wool winter knitted warm long wrap tartan silk cosy striped knit', 'Gloves', 'hands fingers winter warm leather mittens pair boxing rubber gardening woolen palms'],
    ['Sneakers', 'running laces sport rubber trainers comfy gym canvas kicks soles sporty white', 'Sandals', 'summer toes beach straps feet open flipflops buckle holiday sunshine roman toenails'],
    ['Crown', 'king queen gold jewels royal throne head coronation jewel prince velvet heavy', 'Tiara', 'princess sparkle diamonds wedding royal pageant head headband bride glitter crystal tiny'],
    ['Pajamas', 'sleep bedtime night comfy stripes cotton slippers onesie flannel buttons sleepover morning', 'Tracksuit', 'sport zip jogging gym comfy hoodie athlete sweatpants trainers lazy matching nylon'],
    ['Raincoat', 'wet hood yellow waterproof storm puddles slicker plastic poncho wellies showers fisherman', 'Jacket', 'zip pockets leather denim warm sleeves autumn blazer bomber puffer collar zipper'],
  ]),
  cat('fantasy', 'Fantasy', 'magic story legend imaginary myth fairy tale', [
    ['Dragon', 'fire wings scales treasure castle knight breathe lair dungeon smoke hoard egg', 'Dinosaur', 'fossil extinct jurassic roar bones giant prehistoric trex raptor meteor skeleton stomp'],
    ['Wizard', 'wand spell staff beard robe magic hat merlin tower scroll owl apprentice', 'Witch', 'broom cauldron spell potion hat cat halloween hag warts coven pointy cackle'],
    ['Robot', 'metal machine beep circuits android battery future cyborg laser vacuum metallic program', 'Alien', 'ufo space green planet invasion spaceship martian abduction antenna galaxy saucer probe'],
    ['Ghost', 'haunted boo sheet spooky invisible spirit castle poltergeist chains moan transparent attic', 'Vampire', 'fangs blood bite coffin dracula night cape garlic transylvania stake pale immortal'],
    ['Pirate', 'ship treasure parrot eyepatch sword captain map plank hook rum cannon island', 'Ninja', 'stealth sword shadow mask silent japan stars turtles dojo throwing kick black'],
  ]),
  cat('things', 'Things', 'object useful small gadget item handy pocket', [
    ['Camera', 'photo lens flash picture click zoom film tripod selfie snap shutter memory', 'Telescope', 'stars lens moon astronomy zoom planets night observatory galileo spyglass galaxy eyepiece'],
    ['Clock', 'time ticking hands alarm hour wall minutes grandfather cuckoo midnight face second', 'Calendar', 'dates month days planner wall year appointments schedule january weekend diary deadline'],
    ['Key', 'door ring metal unlock spare pocket turn house car lost hook copy', 'Lock', 'key chain door secure safe combination bolt keyhole bike gate code burglar'],
    ['Map', 'directions route paper treasure north atlas compass legend scale globe gps folded', 'Compass', 'north needle direction magnet hiking south navigation points rose arrow scout explorer'],
    ['Balloon', 'party air pop float string helium birthday hot inflate pin bunch latex', 'Kite', 'string wind fly tail beach sky park flying breeze diamond ribbons hill'],
  ]),
];

export const categoryById = (id: string): Category => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

/** Every word in a category, in list order (the imposter's guesses). */
export const wordsIn = (c: Category): string[] => c.pairs.flat().map((w) => w.word);

/** A word's entry within its category. */
export const entryFor = (c: Category, word: string): Word | undefined => c.pairs.flat().find((w) => w.word === word);

/** Lower-case letters only: how clues and words are compared. */
export const norm = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');
