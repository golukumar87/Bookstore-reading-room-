const gutenbergEdition = (bookId, title, author, ebookId, category = 'World Classics') => ({
  bookId,
  title,
  author,
  category,
  image: `https://www.gutenberg.org/cache/epub/${ebookId}/pg${ebookId}.cover.medium.jpg`,
  gutenbergId: ebookId,
  credit: `${author} · Project Gutenberg ebook #${ebookId}`,
  sourceName: 'Project Gutenberg',
  sourceUrl: `https://www.gutenberg.org/ebooks/${ebookId}`,
  editionNote: 'This is a free edition hosted by Project Gutenberg. Public-domain status can vary by country.'
})

const wikisourceEdition = (bookId, title, author, sourceUrl, credit, options = {}) => ({
  bookId,
  title,
  author,
  category: options.category || 'Indian Granth',
  image: options.coverImage || `https://covers.openlibrary.org/b/title/${encodeURIComponent(title)}-M.jpg?default=false`,
  credit,
  sourceName: 'English Wikisource',
  sourceUrl,
  editionNote: 'This historical translation is hosted by Wikisource. Translation and public-domain status can vary by country.'
})

const readerCatalog = [
  {
    bookId: 'pride',
    textFile: 'pride-and-prejudice.txt',
    gutenbergId: 1342,
    credit: 'Jane Austen',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1342'
  },
  {
    bookId: 'more-children-alice-s-adventures-in-wonderland',
    textFile: 'alice-adventures-in-wonderland.txt',
    gutenbergId: 11,
    credit: 'Lewis Carroll',
    sourceUrl: 'https://www.gutenberg.org/ebooks/11'
  },
  {
    bookId: 'more-sci-fi-the-time-machine',
    textFile: 'the-time-machine.txt',
    gutenbergId: 35,
    credit: 'H. G. Wells',
    sourceUrl: 'https://www.gutenberg.org/ebooks/35'
  },
  {
    bookId: 'more-sci-fi-the-war-of-the-worlds',
    textFile: 'the-war-of-the-worlds.txt',
    gutenbergId: 36,
    credit: 'H. G. Wells',
    sourceUrl: 'https://www.gutenberg.org/ebooks/36'
  },
  {
    bookId: 'more-indian-granth-the-song-celestial-bhagavad-gita',
    textFile: 'song-celestial-bhagavad-gita.txt',
    gutenbergId: 2388,
    credit: 'Sir Edwin Arnold (1885 English verse translation)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/2388',
    editionNote: 'This is Edwin Arnold’s public-domain English translation; other Bhagavad Gita editions in the store may use different translations.'
  },
  {
    bookId: 'more-indian-granth-the-ramayana-griffith-translation',
    textFile: 'ramayana-griffith-translation.txt',
    gutenbergId: 24869,
    credit: 'Ralph T. H. Griffith (1870–1874 English verse translation)',
    sourceUrl: 'https://www.gutenberg.org/ebooks/24869',
    editionNote: 'This is Griffith’s public-domain English translation of Valmiki’s Ramayana.'
  },
  {
    bookId: 'kabir-poems',
    textFile: 'songs-of-kabir.txt',
    gutenbergId: 6519,
    credit: 'Kabir, translated into English verse by Rabindranath Tagore',
    sourceUrl: 'https://www.gutenberg.org/ebooks/6519',
    editionNote: 'A public-domain English translation of Kabir’s songs; it is not a Hindi-text edition.'
  },
  {
    bookId: 'gitanjali',
    image: 'https://www.gutenberg.org/cache/epub/7164/pg7164.cover.medium.jpg',
    gutenbergId: 7164,
    credit: 'Rabindranath Tagore',
    sourceUrl: 'https://www.gutenberg.org/ebooks/7164',
    editionNote: 'Read the public-domain English edition online at Project Gutenberg.'
  },
  {
    bookId: 'more-indian-granth-the-prem-sagur-ocean-of-love',
    textFile: 'prem-sagur.txt',
    gutenbergId: 74050,
    credit: 'Caturbhujamisra; English translation by W. Hollings',
    sourceUrl: 'https://www.gutenberg.org/ebooks/74050',
    editionNote: 'A public-domain English translation of Lallu Lal’s Braj Bhasha Krishna narrative.'
  },
  {
    bookId: 'more-indian-non-fiction-autobiography-of-a-yogi',
    textFile: 'autobiography-of-a-yogi.txt',
    gutenbergId: 7452,
    credit: 'Paramahansa Yogananda',
    sourceUrl: 'https://www.gutenberg.org/ebooks/7452',
    editionNote: 'The original English-language public-domain edition.'
  },
  {
    bookId: 'more-business-the-art-of-money-getting',
    image: 'https://www.gutenberg.org/cache/epub/8581/pg8581.cover.medium.jpg',
    gutenbergId: 8581,
    credit: 'P. T. Barnum',
    sourceUrl: 'https://www.gutenberg.org/ebooks/8581',
    editionNote: 'Read the public-domain edition online at Project Gutenberg.'
  },
  {
    bookId: 'more-self-help-as-a-man-thinketh',
    image: 'https://www.gutenberg.org/cache/epub/4507/pg4507.cover.medium.jpg',
    gutenbergId: 4507,
    credit: 'James Allen',
    sourceUrl: 'https://www.gutenberg.org/ebooks/4507',
    editionNote: 'Read the public-domain edition online at Project Gutenberg.'
  },
  {
    bookId: 'more-non-fiction-the-autobiography-of-benjamin-franklin',
    image: 'https://www.gutenberg.org/cache/epub/20203/pg20203.cover.medium.jpg',
    gutenbergId: 20203,
    credit: 'Benjamin Franklin',
    sourceUrl: 'https://www.gutenberg.org/ebooks/20203',
    editionNote: 'Read the public-domain edition online at Project Gutenberg.'
  },
  {
    bookId: 'more-hindi-literature-idgah',
    textFile: 'idgah-hindi.txt',
    credit: 'Munshi Premchand (Hindi original; 1947 edition)',
    sourceName: 'Hindi Wikisource',
    sourceUrl: 'https://hi.wikisource.org/wiki/मानसरोवर_१/ईदगाह',
    textFormat: 'plain',
    editionNote: 'Free Hindi text from the 1947 Mansarovar edition; the source transcription may contain scan/OCR errors.'
  },
  gutenbergEdition('reader-upanishads-paramananda', 'The Upanishads', 'Translated by Swami Paramananda', 3283, 'Indian Granth'),
  gutenbergEdition('reader-yoga-sutras-johnston', 'The Yoga Sutras of Patanjali', 'Patanjali; translated by Charles Johnston', 2526, 'Indian Granth'),
  gutenbergEdition('reader-vishnu-purana-wilson', 'The Vishnu Purana', 'Translated by Manmatha Nath Dutt and H. H. Wilson', 66208, 'Indian Granth'),
  wikisourceEdition(
    'reader-katha-upanishad-muller',
    'Katha Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_15/Katha-upanishad',
    'F. Max Müller · Sacred Books of the East, Volume 15'
  ),
  wikisourceEdition(
    'reader-mundaka-upanishad-muller',
    'Mundaka Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_15/Mundaka-upanishad',
    'F. Max Müller · Sacred Books of the East, Volume 15',
    { coverImage: 'https://covers.openlibrary.org/b/id/3323491-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-prasna-upanishad-muller',
    'Prasna Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_15/Prasna-upanishad',
    'F. Max Müller · Sacred Books of the East, Volume 15',
    { coverImage: 'https://covers.openlibrary.org/b/id/1757293-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-chandogya-upanishad-muller',
    'Chandogya Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_1/Kh%C3%A2ndogya-upanishad',
    'F. Max Müller · Sacred Books of the East, Volume 1',
    { coverImage: 'https://covers.openlibrary.org/b/id/6357562-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-talavakara-upanishad-muller',
    'Talavakara Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_1/Talavak%C3%A2ra-upanishad',
    'F. Max Müller · Sacred Books of the East, Volume 1',
    { coverImage: 'https://covers.openlibrary.org/b/id/6357562-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-vajasaneyi-upanishad-muller',
    'Vajasaneyi Samhita Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_1/V%C3%A2gasaneyi-samhit%C3%A2-upanishad',
    'F. Max Müller · Sacred Books of the East, Volume 1',
    { coverImage: 'https://covers.openlibrary.org/b/id/6357562-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-taittiriya-upanishad-muller',
    'Taittiriya Upanishad',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Taittiriya_Upanishad',
    'F. Max Müller · public-domain English translation',
    { coverImage: 'https://covers.openlibrary.org/b/id/5622317-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-ashtavakra-gita',
    'Ashtavakra Gita',
    'Traditional; English edition hosted by Wikisource',
    'https://en.wikisource.org/wiki/Ashtavakra_Gita',
    'English Wikisource',
    { coverImage: 'https://covers.openlibrary.org/b/id/10296792-M.jpg?default=false' }
  ),
  gutenbergEdition('reader-mahabharata-ganguli-volume-one', 'The Mahabharata of Krishna-Dwaipayana Vyasa, Volume 1', 'Translated by Kisari Mohan Ganguli', 15474, 'Indian Granth'),
  wikisourceEdition(
    'reader-rig-veda-mandala-one',
    'Rig Veda Samhita: Mandala 1',
    'Traditional Vedic text; English edition hosted by Wikisource',
    'https://en.wikisource.org/wiki/Rig_Veda,_Samhita,_Mandala_1',
    'English Wikisource',
    { coverImage: 'https://covers.openlibrary.org/b/id/13281940-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-sacred-books-east-volume-one',
    'Sacred Books of the East, Volume 1: The Upanishads',
    'Translated by F. Max Müller',
    'https://en.wikisource.org/wiki/Sacred_Books_of_the_East/Volume_1',
    'F. Max Müller · Sacred Books of the East, Volume 1',
    { coverImage: 'https://covers.openlibrary.org/b/id/6357562-M.jpg?default=false' }
  ),
  wikisourceEdition(
    'reader-stories-indias-gods-heroes',
    "Stories of India's Gods and Heroes",
    'W. J. Wilkins',
    'https://en.wikisource.org/wiki/Stories_of_India%27s_Gods_%26_Heroes',
    'W. J. Wilkins · historical edition'
  ),
  gutenbergEdition('reader-sherlock-holmes', 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 1661),
  gutenbergEdition('reader-moby-dick', 'Moby-Dick; or, The Whale', 'Herman Melville', 2701),
  gutenbergEdition('reader-jane-eyre', 'Jane Eyre', 'Charlotte Brontë', 1260),
  gutenbergEdition('reader-great-expectations', 'Great Expectations', 'Charles Dickens', 1400),
  gutenbergEdition('reader-tale-of-two-cities', 'A Tale of Two Cities', 'Charles Dickens', 98),
  gutenbergEdition('reader-war-and-peace', 'War and Peace', 'Leo Tolstoy', 2600),
  gutenbergEdition('reader-les-miserables', 'Les Misérables', 'Victor Hugo', 135),
  gutenbergEdition('reader-count-of-monte-cristo', 'The Count of Monte Cristo', 'Alexandre Dumas', 1184),
  gutenbergEdition('reader-don-quixote', 'Don Quixote', 'Miguel de Cervantes', 996),
  gutenbergEdition('reader-odyssey', 'The Odyssey', 'Homer; translated by Samuel Butler', 1727),
  gutenbergEdition('reader-iliad', 'The Iliad', 'Homer; translated by Samuel Butler', 6130),
  gutenbergEdition('reader-scarlet-letter', 'The Scarlet Letter', 'Nathaniel Hawthorne', 33),
  gutenbergEdition('reader-call-of-the-wild', 'The Call of the Wild', 'Jack London', 215),
  gutenbergEdition('reader-white-fang', 'White Fang', 'Jack London', 910),
  gutenbergEdition('reader-treasure-island', 'Treasure Island', 'Robert Louis Stevenson', 120),
  gutenbergEdition('reader-secret-garden', 'The Secret Garden', 'Frances Hodgson Burnett', 113),
  gutenbergEdition('reader-black-beauty', 'Black Beauty', 'Anna Sewell', 271),
  gutenbergEdition('reader-wizard-of-oz', 'The Wonderful Wizard of Oz', 'L. Frank Baum', 55),
  gutenbergEdition('reader-anne-of-green-gables', 'Anne of Green Gables', 'L. M. Montgomery', 45),
  gutenbergEdition('reader-peter-pan', 'Peter Pan', 'J. M. Barrie', 16),
  gutenbergEdition('reader-christmas-carol', 'A Christmas Carol', 'Charles Dickens', 46),
  gutenbergEdition('reader-tom-sawyer', 'The Adventures of Tom Sawyer', 'Mark Twain', 74),
  gutenbergEdition('reader-huckleberry-finn', 'Adventures of Huckleberry Finn', 'Mark Twain', 76)
]

export default readerCatalog
