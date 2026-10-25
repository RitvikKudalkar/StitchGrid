// Openly licensed pictures of needlework, downloaded with credits in src/assets/archive/credits.json.
// They show the world around the tools and are never presented as PatternSquare's own work.
// Always show the credit next to the picture.
import berlinChart from '../assets/archive/berlin-chart.webp';
import sampler from '../assets/archive/sampler-1937.jpg';
import sampler1791 from '../assets/archive/sampler-1791.jpg';
import skeins from '../assets/archive/skeins-of-thread.jpg';
import flossBox from '../assets/archive/floss-box.jpg';

export const archive = {
  berlinChart: {
    image: berlinChart,
    alt: 'A 19th-century needlework chart hand-painted square by square on graph paper: a bird, a basket of flowers and a nest of eggs',
    credit: 'Needlework pattern (1800–1900), A. Nicolai, Berlin. Museum of New Zealand Te Papa Tongarewa, CC0',
    source: 'https://www.rawpixel.com/image/9957675/needlework-pattern-1800-1900-nicolai',
  },
  sampler: {
    image: sampler,
    alt: 'A watercolour record of a stitched alphabet sampler: rows of letters and numbers with a border of crosses and a band of flowers',
    credit: 'Elzy J. Bird, Embroidery Sampler, c. 1937. National Gallery of Art, CC0',
    source: 'https://commons.wikimedia.org/w/index.php?curid=82052617',
  },
  sampler1791: {
    image: sampler1791,
    alt: 'An embroidered sampler of a house between trees, with figures, birds and a dog, signed "Work\'d by Polly Bedford in the Twelfth year of her age 1791"',
    credit: 'Polly Bedford, Sampler, 1791. Art Institute of Chicago, CC0',
    source: 'https://www.artic.edu/artworks/107913',
  },
  skeins: {
    image: skeins,
    alt: 'Loose skeins of embroidery thread in blue, red, gold and cream, tied with a museum label',
    credit: 'Skeins of thread. Auckland War Memorial Museum, CC BY 4.0',
    source: 'https://commons.wikimedia.org/w/index.php?curid=82882482',
  },
  flossBox: {
    image: flossBox,
    alt: 'An open box of Esplen D\'Or floss embroidery thread, with a colour card in the lid and skeins sorted in rows',
    credit: 'Embroidery silks, box of (AM 7143-1), Esplen D\'Or. Auckland War Memorial Museum, CC BY 4.0',
    source: 'https://commons.wikimedia.org/w/index.php?curid=65240157',
  },
};

export type ArchiveKey = keyof typeof archive;
