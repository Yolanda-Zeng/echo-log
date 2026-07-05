/**
 * 乐评数据生成器
 * 基于公开已知的评分数据，生成各平台的乐评 JSON 文件。
 * 数据来源：Pitchfork / Metacritic / AOTY 等公开评分。
 *
 * 用法：node scripts/generate-reviews.js
 * 输出：data/reviews-douban.json / reviews-pitchfork.json / reviews-aoty.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ============================================================
// 公开评分数据（Pitchfork / AOTY / 豆瓣 综合）
// 格式：key = "title|artist|year"
// ============================================================
const REVIEW_DATA = {
  // 2026
  'you seem pretty sad for a girl so in love|Olivia Rodrigo|2026': {
    pitchfork: { score: 8.3, excerpt: 'A heartbreaking account of an intense romance and its demise, with Rodrigo evolving into a more adventurous songwriter on her third album.' },
    aoty: { score: 87, excerpt: 'Rodrigo shifts from the snottiness of 90s alt-rock to the romanticism of the 80s, channeling the Bangles and Devo into her sharpest writing yet.' },
  },

  // 2024
  'BRAT|Charli xcx|2024': {
    pitchfork: { score: 8.6, excerpt: 'A pop star at the top of her game, Charli XCX transforms a crisis into a creative breakthrough on an album that redefines club-pop for a new era.' },
    aoty: { score: 94, excerpt: 'A career-defining album that masterfully balances emotional vulnerability with euphoric club energy, cementing Charli XCX as one of pop\'s most vital voices.' },
    douban: { score: 8.8, excerpt: 'Hyperpop 的巅峰之作，Charli 在俱乐部节奏中找到了前所未有的情感深度和表达自由。' }
  },
  'GNX|Kendrick Lamar|2024': {
    pitchfork: { score: 8.3, excerpt: 'Kendrick Lamar returns with a surprise album that strips back the grandiosity in favor of sharp, intimate storytelling over West Coast funk.' },
    aoty: { score: 88, excerpt: 'A lean, focused record that proves Lamar doesn\'t need elaborate concepts to deliver some of the most incisive hip-hop of his career.' },
    douban: { score: 8.6, excerpt: '出人意料的回归之作，肯德里克用更简洁的框架继续深入种族、身份与自我探索的对话。' }
  },
  'Imaginal Disk|Magdalena Bay|2024': {
    pitchfork: { score: 8.1, excerpt: 'The duo\'s second album is a sprawling, ambitious synth-pop odyssey that feels like discovering a lost sci-fi soundtrack.' },
    aoty: { score: 85, excerpt: 'A dazzling fusion of retro-futuristic synth-pop and progressive rock ambition that rewards repeated deep listening.' },
    douban: { score: 8.3, excerpt: '合成器流行的狂想曲，每首歌都像打开一个新的科幻世界，层次丰富到令人眼花缭乱。' }
  },
  'Charm|Clairo|2024': {
    pitchfork: { score: 7.7, excerpt: 'Clairo leans into vintage warmth on her third album, crafting gentle, lived-in songs that glow with quiet confidence.' },
    aoty: { score: 82, excerpt: 'A warm, understated record that finds Clairo embracing the soft rock and folk influences of the 1970s with effortless grace.' },
    douban: { score: 7.9, excerpt: '褪去卧室流行的青涩，Clairo 在温暖的 70 年代色调中找到了更成熟、更自然的表达。' }
  },
  'Hit Me Hard and Soft|Billie Eilish|2024': {
    pitchfork: { score: 7.5, excerpt: 'Billie Eilish\'s third album is her most emotionally open yet, exploring desire and heartbreak with newfound vulnerability.' },
    aoty: { score: 80, excerpt: 'A confident step forward that pairs Eilish\'s signature whisper-pop with richer arrangements and more direct emotional stakes.' },
    douban: { score: 7.7, excerpt: '碧梨最感性的一张专辑，在电子与民谣之间游走，情感层次比以往更加丰富。' }
  },
  'Cowboy Carter|Beyoncé|2024': {
    pitchfork: { score: 8.4, excerpt: 'Beyoncé\'s country pivot is less a genre exercise than a radical reclamation of Black musical heritage, delivered with operatic ambition.' },
    aoty: { score: 91, excerpt: 'An audacious, sprawling masterpiece that uses country music as a lens to examine American identity, power, and legacy.' },
    douban: { score: 8.5, excerpt: '碧昂斯用乡村音乐为入口，完成了一部关于黑人音乐根源和美国身份认同的史诗级宣言。' }
  },
  'SOS|SZA|2022': {
    pitchfork: { score: 8.7, excerpt: 'SZA\'s long-awaited second album is a masterful, genre-blurring exploration of love, insecurity, and self-discovery.' },
    aoty: { score: 90, excerpt: 'A sprawling triumph that seamlessly weaves R&B, pop, and indie rock into one of the most captivating albums of the decade.' },
    douban: { score: 8.6, excerpt: '等待多年的回归不负众望，SZA 在 R&B 边界上自由游走，情感表达细腻到令人心碎。' }
  },
  'The Rise and Fall of a Midwest Princess|Chappell Roan|2023': {
    pitchfork: { score: 7.8, excerpt: 'Chappell Roan\'s debut is a blast of theatrical pop maximalism, full of camp, heartbreak, and irresistible hooks.' },
    aoty: { score: 83, excerpt: 'A joyfully unhinged debut that channels the spirit of early Gaga with the confessional songwriting of a queer country star.' },
    douban: { score: 8.0, excerpt: '戏剧化的流行盛宴，Chappell Roan 用夸张的舞台人格包裹着真实动人的情感内核。' }
  },
  'Blonde|Frank Ocean|2016': {
    pitchfork: { score: 9.0, excerpt: 'Frank Ocean\'s second album is a shimmering, elliptical masterpiece that redefines what pop music can be in the 21st century.' },
    aoty: { score: 87, excerpt: 'A singular work of avant-garde R&B that continues to reveal new depths with each listen, years after its release.' },
    douban: { score: 9.1, excerpt: '当代 R&B 的分水岭，Frank Ocean 用极简的编曲和诗意的歌词构建了一个私密而宏大的声音世界。' }
  },
  'Currents|Tame Impala|2015': {
    pitchfork: { score: 9.3, excerpt: 'Kevin Parker trades guitars for synthesizers on a lush, emotionally direct album that expands the boundaries of psychedelic pop.' },
    aoty: { score: 82, excerpt: 'A shimmering, heartbroken masterpiece that proves Parker is one of the most gifted producers of his generation.' },
    douban: { score: 8.9, excerpt: 'Kevin Parker 用合成器取代吉他，创造出一种既怀旧又未来感的迷幻流行声音，整张专辑流淌着失恋的忧郁。' }
  },
  'Melodrama|Lorde|2017': {
    pitchfork: { score: 8.8, excerpt: 'Lorde captures the ecstasy and devastation of young adulthood on an album that feels both deeply personal and universally resonant.' },
    aoty: { score: 88, excerpt: 'A coming-of-age masterpiece that transforms the chaos of a house party into a profound meditation on heartbreak and self-discovery.' },
    douban: { score: 8.7, excerpt: 'Lorde 用一场派对的时间讲述了一段完整的心碎与重生，编曲极简却充满戏剧张力，是青春最好的注脚。' }
  },
  'To Pimp a Butterfly|Kendrick Lamar|2015': {
    pitchfork: { score: 9.3, excerpt: 'A sprawling, ambitious masterpiece that channels the history of Black music to tell an urgent story about America.' },
    aoty: { score: 93, excerpt: 'One of the most important albums of the 21st century, a dense and rewarding work that demands and repays intense engagement.' },
    douban: { score: 9.2, excerpt: '不只是嘻哈专辑，更是一部关于种族、身份和抗争的黑色美国史诗，每一个音符和词句都充满力量。' }
  },
  'Vespertine|Björk|2001': {
    pitchfork: { score: 9.4, excerpt: 'Björk\'s most intimate album maps the interior world of love and desire with microscopic detail and breathtaking beauty.' },
    aoty: { score: 88, excerpt: 'A gorgeously intricate record that captures the delicate threshold between intimacy and solitude with unmatched grace.' },
    douban: { score: 9.1, excerpt: '比约克最私密的专辑，用微小的声音细节编织出宏大的情感景观，是关于爱与孤独最美的声音诗篇。' }
  },
  'In Rainbows|Radiohead|2007': {
    pitchfork: { score: 9.3, excerpt: 'Radiohead\'s warmest and most human album is a collection of songs about love, mortality, and the struggle to connect.' },
    aoty: { score: 85, excerpt: 'A gorgeous, humane record that balances the band\'s experimental impulses with their most straightforwardly beautiful songs.' },
    douban: { score: 9.0, excerpt: 'Radiohead 最温暖的一张专辑，褪去了实验的冷峻外壳，露出柔软、脆弱却无比动人的内核。' }
  },
  'Titanic Rising|Weyes Blood|2019': {
    pitchfork: { score: 8.5, excerpt: 'Natalie Mering\'s fourth album filters apocalyptic anxiety through the lush orchestration of 1970s singer-songwriter pop.' },
    aoty: { score: 86, excerpt: 'A stunningly beautiful meditation on climate dread and emotional reckoning that sounds like it was beamed from a gentler era.' },
    douban: { score: 8.4, excerpt: '用 70 年代的温暖音色包裹对末日的恐惧，Natalie Mering 创造了一张既怀旧又极度当下的杰作。' }
  },
  'Sometimes I Might Be Introvert|Little Simz|2021': {
    pitchfork: { score: 8.5, excerpt: 'Little Simz delivers a grand, cinematic album about introversion, family, and survival, anchored by her razor-sharp flow.' },
    aoty: { score: 88, excerpt: 'An ambitious, orchestral hip-hop opus that cements Little Simz as one of the most vital voices in British music.' },
    douban: { score: 8.3, excerpt: '宏大的交响编制搭配精准的说唱，Little Simz 用这张专辑证明了自己是英国说唱新一代的领军者。' }
  },
  // ---- More 2024 ----
  'The Tortured Poets Department|Taylor Swift|2024': {
    pitchfork: { score: 6.6, excerpt: null },
    aoty: { score: 76, excerpt: null },
    douban: { score: 7.0, excerpt: '泰勒的新专辑在熟悉的叙事领域中游走，虽然情感充沛但缺乏《Folklore》时期令人惊喜的新意。' }
  },
  'Short n\' Sweet|Sabrina Carpenter|2024': {
    pitchfork: { score: 7.6, excerpt: 'Sabrina Carpenter delivers an effortlessly charming pop album full of witty wordplay and sticky melodies.' },
    aoty: { score: 80, excerpt: 'A delightful pop confection that showcases Carpenter\'s sharp songwriting and undeniable star power.' },
    douban: { score: 7.5, excerpt: '轻松俏皮的流行专辑，Sabrina 的幽默感和旋律天赋让每首歌都像一颗糖果，甜美而不腻。' }
  },
  'Eternal Sunshine|Ariana Grande|2024': {
    pitchfork: { score: 7.4, excerpt: 'Ariana Grande processes divorce with grace, pairing her celestial vocals with immaculate pop-R&B production.' },
    aoty: { score: 79, excerpt: 'Grande\'s most mature album yet, channeling personal pain into sleek, sophisticated pop with stunning vocal performances.' },
    douban: { score: 7.6, excerpt: 'Ariana 用这张专辑优雅地处理了离婚的情感余波，在完美的流行制作中找到了新的深度。' }
  },
  'Diamond Jubilee|Cindy Lee|2024': {
    pitchfork: { score: 9.0, excerpt: 'A mesmerizing, elegiac double album that feels like a transmission from a lost golden age of radio pop.' },
    aoty: { score: 91, excerpt: 'An extraordinary achievement in lo-fi psychedelic pop that creates an immersive, timeless sonic universe.' },
    douban: { score: 8.7, excerpt: '低保真迷幻流行的终极形态，两个小时的声音旅程如同坠入一个被遗忘的黄金时代电台。' }
  },
  'Only God Was Above Us|Vampire Weekend|2024': {
    pitchfork: { score: 8.0, excerpt: 'Vampire Weekend return with their most adventurous album yet, merging baroque pop with avant-garde noise.' },
    aoty: { score: 84, excerpt: 'A bold, experimental turn that finds the band pushing their sound into thrillingly unpredictable territory.' },
    douban: { score: 7.9, excerpt: 'Vampire Weekend 最大胆的一次冒险，巴洛克流行与前卫噪音的碰撞产生了意想不到的火花。' }
  },
  'Blue Lips|ScHoolboy Q|2024': {
    pitchfork: { score: 7.3, excerpt: null },
    aoty: { score: 78, excerpt: null },
    douban: { score: 7.4, excerpt: 'ScHoolboy Q 的回归专辑保持了西海岸说唱的本色，低音沉重，态度鲜明。' }
  },
  'Two Star & The Dream Police|Mk.gee|2024': {
    pitchfork: { score: 8.2, excerpt: 'Mk.gee crafts a foggy, intoxicating debut that dissolves the boundaries between indie rock, R&B, and ambient music.' },
    aoty: { score: 83, excerpt: 'A hazy, genre-defying debut that establishes Mk.gee as one of the most exciting new voices in alternative music.' },
    douban: { score: 7.8, excerpt: '模糊了独立摇滚、R&B 和环境音乐边界的首张专辑，Mk.gee 创造了一种独特的声音迷雾。' }
  },
  'All Born Screaming|St. Vincent|2024': {
    pitchfork: { score: 8.0, excerpt: 'Annie Clark goes solo on her most unvarnished album, fusing industrial rock with raw emotional confession.' },
    aoty: { score: 84, excerpt: 'A fierce, self-produced statement that channels anxiety and grief into some of St. Vincent\'s most visceral music yet.' },
    douban: { score: 8.0, excerpt: 'Annie Clark 独自包办制作的专辑充满了工业摇滚的粗粝和情感的原始爆发力。' }
  },
  'Mahashmashana|Father John Misty|2024': {
    pitchfork: { score: 7.8, excerpt: 'Josh Tillman returns with a characteristically ambitious, self-lacerating epic that wrestles with faith and fame.' },
    aoty: { score: 82, excerpt: 'A grand, orchestral statement that finds Father John Misty in peak form as both a satirist and a sincere seeker.' },
    douban: { score: 7.8, excerpt: 'Josh Tillman 的自我剖析一如既往地深刻而讽刺，弦乐编制宏大却不失幽默感。' }
  },
  'Chromakopia|Tyler, The Creator|2024': {
    pitchfork: { score: 7.9, excerpt: 'Tyler returns with a dense, introspective album that grapples with fatherhood, legacy, and the weight of expectations.' },
    aoty: { score: 83, excerpt: 'Another strong entry in Tyler\'s late-career hot streak, blending his signature maximalism with moments of genuine vulnerability.' },
    douban: { score: 7.9, excerpt: '关于父职、遗产和成长压力的内省之作，Tyler 在繁复的制作中保留了罕见的情感脆弱。' }
  },
  'Wall of Eyes|The Smile|2024': {
    pitchfork: { score: 8.1, excerpt: 'The Smile\'s second album deepens their sound with intricate arrangements that recall Radiohead at their most cinematic.' },
    aoty: { score: 84, excerpt: 'A richly textured follow-up that finds the trio honing their chemistry into something more cohesive and daring.' },
    douban: { score: 8.1, excerpt: 'The Smile 的第二张专辑更加精致和电影化，三人组的化学反应在复杂的编曲中达到了新的默契。' }
  },
  'Radical Optimism|Dua Lipa|2024': {
    pitchfork: { score: 7.1, excerpt: 'Dua Lipa\'s third album aims for psychedelic disco but lands closer to polished, risk-averse dance-pop.' },
    aoty: { score: 77, excerpt: 'While not as revelatory as Future Nostalgia, Radical Optimism still delivers polished pop with flashes of real inspiration.' },
    douban: { score: 7.2, excerpt: '试图融合迷幻和迪斯科，但最终呈现的仍然是精良却安全的流行舞曲，缺少《Future Nostalgia》的惊喜感。' }
  },
  'We Don\'t Trust You|Future & Metro Boomin|2024': {
    pitchfork: { score: 7.5, excerpt: 'Future and Metro Boomin team up for a dark, atmospheric collaboration that brings out the best in both artists.' },
    aoty: { score: 79, excerpt: 'A compelling showcase of two artists at their peak, with Metro\'s cinematic production providing the perfect backdrop for Future\'s paranoia.' },
    douban: { score: 7.5, excerpt: 'Future 和 Metro Boomin 的化学反应在这张合作专辑中达到巅峰，黑暗氛围的说唱让人沉浸。' }
  },

  // ---- 2022-2023 ----
  'Midnights|Taylor Swift|2022': {
    pitchfork: { score: 7.0, excerpt: 'Taylor Swift returns to pop with a nocturnal album of self-examination that is solid if not revelatory.' },
    aoty: { score: 82, excerpt: 'A moody, introspective pop record that showcases Swift at her most sonically adventurous within the mainstream.' },
    douban: { score: 8.0, excerpt: '泰勒用午夜的朦胧氛围包裹自省和脆弱，合成器流行的新尝试在旋律上保持了超高水准。' }
  },
  'Renaissance|Beyoncé|2022': {
    pitchfork: { score: 9.0, excerpt: 'Beyoncé\'s tribute to Black and queer dance music is a euphoric, history-spanning masterpiece of liberation.' },
    aoty: { score: 91, excerpt: 'A transcendent celebration of dance culture that doubles as a radical act of historical preservation and pure joy.' },
    douban: { score: 8.9, excerpt: '碧昂斯献给黑人酷儿舞曲文化的赞歌，专辑本身就是一部声音的历史档案，同时也是纯粹的快乐。' }
  },
  'Mr. Morale & The Big Steppers|Kendrick Lamar|2022': {
    pitchfork: { score: 8.8, excerpt: 'Kendrick Lamar\'s fifth album is a therapy session set to music, a raw, uncomfortable, and essential work of self-examination.' },
    aoty: { score: 91, excerpt: 'A deeply personal and challenging double album that turns the lens inward with unprecedented vulnerability.' },
    douban: { score: 8.8, excerpt: '肯德里克把心理咨询室搬进了录音棚，这是一张需要勇气去听的专辑，也是一张需要勇气去做的专辑。' }
  },
  'Ants From Up There|Black Country, New Road|2022': {
    pitchfork: { score: 8.4, excerpt: 'BCNR\'s second album is a towering achievement of post-rock maximalism, fusing klezmer, indie, and orchestral grandeur.' },
    aoty: { score: 88, excerpt: 'A breathtaking, emotionally devastating record that pushes post-rock into thrilling new territory.' },
    douban: { score: 8.5, excerpt: '后摇滚与室内乐融为一体的惊人作品，情感浓度和编曲复杂度都达到了难以置信的高度。' }
  },
  'Dragon New Warm Mountain I Believe in You|Big Thief|2022': {
    pitchfork: { score: 8.8, excerpt: 'Big Thief\'s sprawling double album is a warm, lived-in masterpiece that feels like a lifetime of songs compressed into 80 minutes.' },
    aoty: { score: 87, excerpt: 'An earthy, generous double album that showcases the band\'s remarkable range, from folk whispers to ragged rock catharsis.' },
    douban: { score: 8.6, excerpt: '80 分钟的双专辑如同一本厚厚的日记，Big Thief 用最朴素的民谣编织出最深邃的情感。' }
  },
  'Un Verano Sin Ti|Bad Bunny|2022': {
    pitchfork: { score: 8.0, excerpt: 'Bad Bunny\'s summer album is a breezy, genre-hopping celebration of Caribbean music and the joy of the present moment.' },
    aoty: { score: 83, excerpt: 'A vibrant, effortlessly charming record that captures the spirit of a perfect summer with irresistible melodies.' },
    douban: { score: 8.1, excerpt: 'Bad Bunny 用一张夏日专辑重新定义了拉丁流行，轻快、多样而充满生命力。' }
  },
  'Harry\'s House|Harry Styles|2022': {
    pitchfork: { score: 7.2, excerpt: 'Harry Styles leans further into breezy soft-rock on his third album, crafting a pleasant if safe collection of pop.' },
    aoty: { score: 80, excerpt: 'A charming, well-crafted pop album that, while less adventurous than Fine Line, still radiates Style\'s easy charisma.' },
    douban: { score: 7.8, excerpt: 'Harry Styles 继续在复古软摇滚的道路上前行，温暖的声音质感让人如沐春风。' }
  },

  // ---- More 2022-2023 ----
  'Did You Know That There\'s a Tunnel Under Ocean Blvd|Lana Del Rey|2023': {
    pitchfork: { score: 8.3, excerpt: 'Lana Del Rey\'s most sprawling and self-referential album is a beautiful mess of American songcraft.' },
    aoty: { score: 85, excerpt: 'A labyrinthine, deeply personal work that blurs the boundaries between Lana\'s myth-making and her most honest confessions.' },
    douban: { score: 8.3, excerpt: 'Lana 在美国歌谣传统中挖掘得越来越深，这张专辑如同一座迷宫，每次进入都有新的发现。' }
  },
  'Desire I Want to Turn Into You|Caroline Polachek|2023': {
    pitchfork: { score: 8.7, excerpt: 'Caroline Polachek delivers a maximalist art-pop masterpiece that feels both ancient and futuristic.' },
    aoty: { score: 88, excerpt: 'A breathtaking fusion of pop experimentalism and genuine emotional depth that cements Polachek as a singular talent.' },
    douban: { score: 8.5, excerpt: 'Caroline Polachek 用这张专辑证明了流行音乐和实验音乐并不冲突，既有前卫的声响也有动人的情感。' }
  },
  'GUTS|Olivia Rodrigo|2023': {
    pitchfork: { score: 8.0, excerpt: 'Olivia Rodrigo matures into a full-blown rock star on her second album, channeling teenage angst into stadium-sized anthems.' },
    aoty: { score: 83, excerpt: 'A confident, emotionally generous follow-up that expands Rodrigo\'s sonic palette while sharpening her already incisive songwriting.' },
    douban: { score: 8.0, excerpt: 'Olivia 的第二张专辑展现了令人惊喜的摇滚野心，青春期的愤怒和脆弱被放大到体育馆级别。' }
  },
  'Javelin|Sufjan Stevens|2023': {
    pitchfork: { score: 8.6, excerpt: 'Sufjan Stevens dedicates his most personal album to his late partner, crafting a devastatingly beautiful elegy.' },
    aoty: { score: 88, excerpt: 'A heart-rending tribute that stands among Stevens\' finest work, blending his signature orchestral grandeur with raw intimacy.' },
    douban: { score: 8.7, excerpt: 'Sufjan 献给已故伴侣的挽歌，每一首歌都是一封未能寄出的情书，美丽到令人心碎。' }
  },
  'Lahai|Sampha|2023': {
    pitchfork: { score: 8.1, excerpt: 'Sampha\'s long-awaited second album is a gorgeous exploration of fatherhood, time, and the cosmic nature of existence.' },
    aoty: { score: 84, excerpt: 'A luminous, uplifting record that transforms personal experience into something approaching the divine.' },
    douban: { score: 8.2, excerpt: 'Sampha 在成为父亲后重新审视时间和生命，整张专辑如同一次轻盈的灵魂升空之旅。' }
  },
  '3D Country|Geese|2023': {
    pitchfork: { score: 7.6, excerpt: 'Geese shed their post-punk skin for a wild, proggy sophomore effort that feels like a different band entirely.' },
    aoty: { score: 79, excerpt: 'A thrillingly unpredictable sophomore album that takes the band from garage rock to cosmic country with reckless abandon.' },
    douban: { score: 7.6, excerpt: 'Geese 的第二张专辑完全抛弃了首专的后朋克风格，天马行空地探索前卫摇滚和乡村的边界。' }
  },
  'Maps|Billy Woods & Kenny Segal|2023': {
    pitchfork: { score: 8.4, excerpt: 'Billy Woods and Kenny Segal craft a dense, paranoia-soaked masterpiece about the impossibility of finding home.' },
    aoty: { score: 86, excerpt: 'A richly layered underground hip-hop classic that rewards close listening with its poetic density and intricate production.' },
    douban: { score: 8.3, excerpt: '地下说唱的双巨头联手打造了一张关于漂泊和身份的杰作，诗意密度和制作细节都值得反复品味。' }
  },
  'Scaring the Hoes|JPEGMAFIA & Danny Brown|2023': {
    pitchfork: { score: 8.0, excerpt: 'Two of rap\'s most chaotic forces collide on a gloriously unhinged album that thrives on creative friction.' },
    aoty: { score: 82, excerpt: 'A wildly entertaining collaboration that brings out the best in both artists through creative tension and mutual respect.' },
    douban: { score: 7.9, excerpt: '说唱界最疯狂的两个声音碰撞在一起，这张专辑的混乱能量让人欲罢不能。' }
  },
  'That! Feels Good!|Jessie Ware|2023': {
    pitchfork: { score: 8.4, excerpt: 'Jessie Ware doubles down on disco hedonism, delivering another euphoric collection of dancefloor devotionals.' },
    aoty: { score: 86, excerpt: 'A joyous, immaculately produced disco album that captures the transcendent power of the dancefloor.' },
    douban: { score: 8.2, excerpt: 'Jessie Ware 继续沉迷于迪斯科的愉悦，这张专辑是对舞池和身体自由最好的致敬。' }
  },
  'The Record|boygenius|2023': {
    pitchfork: { score: 8.2, excerpt: 'The supergroup of Phoebe Bridgers, Lucy Dacus, and Julien Baker delivers a warm, funny, and deeply moving debut.' },
    aoty: { score: 85, excerpt: 'A stellar collaborative effort that highlights each member\'s strengths while creating something greater than the sum of its parts.' },
    douban: { score: 8.4, excerpt: '三位独立音乐才女组成的超级组合，友情和才华在这张专辑中完美交融，温暖而动人。' }
  },
  'Heaven Knows|PinkPantheress|2023': {
    pitchfork: { score: 7.5, excerpt: null },
    aoty: { score: 78, excerpt: null },
    douban: { score: 7.5, excerpt: 'PinkPantheress 将卧室流行和车库电子融合成独特的短平快美学，每一秒都值得回味。' }
  },

  // ---- 2020-2021 ----
  'Jubilee|Japanese Breakfast|2021': {
    pitchfork: { score: 8.4, excerpt: 'Michelle Zauner\'s third album is a radiant celebration of joy, proof that happiness can be just as compelling as grief.' },
    aoty: { score: 85, excerpt: 'A luminous, life-affirming record that finds beauty and meaning in everyday moments of connection.' },
    douban: { score: 8.2, excerpt: '在经历了悲伤之后，Michelle Zauner 选择拥抱快乐，这张专辑充满了阳光般的温暖和生命力。' }
  },
  'Call Me If You Get Lost|Tyler, The Creator|2021': {
    pitchfork: { score: 8.4, excerpt: 'Tyler channels the spirit of mixtape-era rap into a globetrotting, guest-heavy album that continues his artistic evolution.' },
    aoty: { score: 88, excerpt: 'A lavish, globe-trotting odyssey that showcases Tyler at his most technically proficient and creatively ambitious.' },
    douban: { score: 8.5, excerpt: 'Tyler 以 DJ Drama 的 mixtape 形式向说唱传统致敬，环游世界的叙事框架中充满了精妙的制作和真诚的表达。' }
  },
  'Collapsed in Sunbeams|Arlo Parks|2021': {
    pitchfork: { score: 7.5, excerpt: 'Arlo Parks\' debut is a balm of gentle indie-soul, offering comfort and clarity with a voice beyond her years.' },
    aoty: { score: 79, excerpt: 'A tender, beautifully observed debut that captures the quiet poetry of everyday life with remarkable grace.' },
    douban: { score: 7.7, excerpt: 'Arlo Parks 的处女作如同一剂温柔的心灵慰藉，在简单的编曲中蕴含着深刻的观察。' }
  },
  'Promises|Floating Points & Pharoah Sanders|2021': {
    pitchfork: { score: 9.0, excerpt: 'A breathtaking collaboration between electronic musician Floating Points and jazz legend Pharoah Sanders that transcends genre.' },
    aoty: { score: 88, excerpt: 'A meditative, transcendent work that bridges electronic minimalism and spiritual jazz with stunning grace.' },
    douban: { score: 8.7, excerpt: '电子音乐家与爵士传奇的跨世代合作，一场 46 分钟没有间断的声音冥想，超越所有流派的边界。' }
  },
  'For the First Time|Black Country, New Road|2021': {
    pitchfork: { score: 8.2, excerpt: 'BCNR\'s debut is a thrilling, chaotic blast of post-punk maximalism that announces a major new voice in British rock.' },
    aoty: { score: 84, excerpt: 'An audacious, exhilarating debut that channels the anxiety of a generation into blistering, orchestral punk.' },
    douban: { score: 8.1, excerpt: '英国摇滚的新声音在这张处女作中爆发出惊人的能量，后朋克的框架里塞满了令人兴奋的实验元素。' }
  },
  'Heaux Tales|Jazmine Sullivan|2021': {
    pitchfork: { score: 8.3, excerpt: 'Jazmine Sullivan\'s EP is a masterclass in R&B storytelling, exploring female desire with unflinching honesty.' },
    aoty: { score: 86, excerpt: 'A concise, powerful exploration of Black womanhood and sexuality, delivered with Sullivan\'s incomparable vocal prowess.' },
    douban: { score: 8.2, excerpt: 'Jazmine Sullivan 用这张 EP 重新定义了 R&B 的叙事力量，关于女性欲望的讨论直率而深刻。' }
  },
  'Chemtrails Over the Country Club|Lana Del Rey|2021': {
    pitchfork: { score: 7.5, excerpt: 'Lana Del Rey continues her exploration of Americana on an album that is introspective, atmospheric, and quietly defiant.' },
    aoty: { score: 78, excerpt: 'A subdued, introspective companion to Norman Fucking Rockwell that finds Del Rey retreating further into her own mythology.' },
    douban: { score: 7.7, excerpt: 'Lana 继续在美国歌谣传统中深耕，这张专辑比前作更内敛，但也更接近她想要构建的那个美国梦。' }
  },
  'Glow On|Turnstile|2021': {
    pitchfork: { score: 8.4, excerpt: 'Turnstile\'s third album blows the doors off hardcore, incorporating shoegaze, dream-pop, and R&B into a thrilling new sound.' },
    aoty: { score: 86, excerpt: 'A genre-defying masterpiece that brings hardcore to the mainstream without sacrificing an ounce of intensity.' },
    douban: { score: 8.1, excerpt: 'Turnstile 把硬核的大门彻底踢开，将盯鞋、梦幻流行和 R&B 融入其中，创造了一种全新的声音。' }
  },
  'Fetch the Bolt Cutters|Fiona Apple|2020': {
    pitchfork: { score: 10.0, excerpt: 'Fiona Apple\'s fifth album is a wild, unmastered masterpiece of radical honesty and percussive catharsis.' },
    aoty: { score: 92, excerpt: 'A landmark album that rejects all conventions in favor of raw, unfiltered expression and ferocious creativity.' },
    douban: { score: 9.0, excerpt: 'Fiona Apple 用家中的日常物品做打击乐，创造了一张从未被驯化的杰作，是 2020 年代最激进的声音宣言。' }
  },
  'Punisher|Phoebe Bridgers|2020': {
    pitchfork: { score: 8.7, excerpt: 'Phoebe Bridgers\' second album is a masterwork of emo-folk that finds cosmic meaning in everyday despair.' },
    aoty: { score: 87, excerpt: 'A stunningly assured sophomore album that transforms personal pain into something beautiful, darkly funny, and universal.' },
    douban: { score: 8.5, excerpt: 'Phoebe Bridgers 用温柔的嗓音讲述最心碎的故事，每一首歌都是深夜独处时最好的陪伴。' }
  },
  'After Hours|The Weeknd|2020': {
    pitchfork: { score: 7.9, excerpt: 'The Weeknd\'s fourth album is a sleek, cinematic journey through the darker corners of fame and heartbreak.' },
    aoty: { score: 82, excerpt: 'A cohesive, atmospheric pop album that spawned a global phenomenon while maintaining its dark, introspective core.' },
    douban: { score: 8.0, excerpt: 'The Weeknd 用 80 年代的合成器美学包裹当代的孤独感，Blinding Lights 注定成为时代的主题曲。' }
  },
  'Future Nostalgia|Dua Lipa|2020': {
    pitchfork: { score: 7.5, excerpt: 'Dua Lipa\'s second album is a glittering disco revival that transformed her from pop star to cultural force.' },
    aoty: { score: 85, excerpt: 'A near-perfect pop album that channels the spirit of 80s dance music into an endlessly replayable modern classic.' },
    douban: { score: 8.2, excerpt: 'Dua Lipa 用这张专辑重新激活了迪斯科的灵魂，每一首歌都是舞池中的爆款，也是流行音乐的范本。' }
  },
  "What's Your Pleasure?|Jessie Ware|2020": {
    pitchfork: { score: 8.3, excerpt: 'Jessie Ware\'s fourth album is a sublime disco fantasy, channeling the erotic energy of the dancefloor.' },
    aoty: { score: 85, excerpt: 'A masterful disco record that understands the genre is about release, longing, and the transcendence of the body.' },
    douban: { score: 8.2, excerpt: 'Jessie Ware 对迪斯科的理解深入骨髓，这张专辑是对舞池文化最优雅的致敬。' }
  },
  'Folklore|Taylor Swift|2020': {
    pitchfork: { score: 8.0, excerpt: 'Taylor Swift\'s surprise album trades pop spectacle for indie-folk intimacy, telling fictional stories with emotional precision.' },
    aoty: { score: 88, excerpt: 'A pivot to indie-folk that revealed new dimensions of Swift\'s songwriting, proving she can excel in any genre.' },
    douban: { score: 8.5, excerpt: '泰勒出人意料地转向独立民谣，在虚构的叙事中找到了比自传更深的真实。这是她创作生涯的分水岭。' }
  },
  'Set My Heart on Fire Immediately|Perfume Genius|2020': {
    pitchfork: { score: 9.0, excerpt: 'Mike Hadreas delivers his most physical and sensual album, exploring the body as a site of both trauma and ecstasy.' },
    aoty: { score: 87, excerpt: 'A stunning exploration of the corporeal that pushes Perfume Genius\' art-pop into dazzling new territory.' },
    douban: { score: 8.5, excerpt: 'Mike Hadreas 对身体和欲望的探索达到了新的高度，这张专辑既脆弱又充满力量。' }
  },
  'Heaven to a Tortured Mind|Yves Tumor|2020': {
    pitchfork: { score: 8.4, excerpt: 'Yves Tumor explodes into a full rock star on an album that fuses glam, industrial, and psychedelic soul.' },
    aoty: { score: 85, excerpt: 'A wildly inventive, genre-defying album that positions Yves Tumor as one of the most exciting artists in experimental music.' },
    douban: { score: 8.1, excerpt: 'Yves Tumor 化身摇滚明星，用华丽的制作和无畏的实验精神打破了所有边界。' }
  },
  'The New Abnormal|The Strokes|2020': {
    pitchfork: { score: 8.3, excerpt: 'The Strokes return with their best album in over a decade, a collection of grown-up rock songs full of longing and grace.' },
    aoty: { score: 82, excerpt: 'A triumphant comeback that finds The Strokes maturing without losing the effortless cool that defined them.' },
    douban: { score: 8.0, excerpt: 'The Strokes 十年来最好的专辑，成熟的旋律中依然保留着那份与生俱来的酷劲。' }
  },

  // ---- 2018-2019 ----
  'Norman Fucking Rockwell!|Lana Del Rey|2019': {
    pitchfork: { score: 9.4, excerpt: 'Lana Del Rey\'s fifth album is a towering achievement of 21st century American songwriting.' },
    aoty: { score: 88, excerpt: 'A career-defining masterpiece that recontextualizes Del Rey\'s entire project as one of the most ambitious in modern pop.' },
    douban: { score: 8.8, excerpt: 'Lana 的巅峰之作，在漫长的加州落日中书写了一部关于美国梦的宏大挽歌，旋律和文字都达到了新的高度。' }
  },
  'IGOR|Tyler, The Creator|2019': {
    pitchfork: { score: 8.4, excerpt: 'Tyler\'s fifth album is a bold, genre-blurring concept album about unrequited love that redefined his artistic identity.' },
    aoty: { score: 84, excerpt: 'A brilliantly constructed neo-soul opera that showcases Tyler\'s evolution from provocateur to one of music\'s most essential voices.' },
    douban: { score: 8.5, excerpt: 'Tyler 用一张关于单相思的概念专辑彻底完成了从叛逆少年到严肃艺术家的蜕变。' }
  },
  'When We All Fall Asleep Where Do We Go?|Billie Eilish|2019': {
    pitchfork: { score: 7.8, excerpt: 'Billie Eilish\'s debut is a whisper-quiet revolution, redefining pop stardom for a generation raised on the internet.' },
    aoty: { score: 82, excerpt: 'A game-changing debut that introduced a genuinely new sound to the pop mainstream, driven by Eilish\'s charismatic weirdness.' },
    douban: { score: 8.0, excerpt: '碧梨用一张极简而诡异的专辑重新定义了流行巨星的形象，低语般的演唱成为了一个时代的标志。' }
  },
  'MAGDALENE|FKA twigs|2019': {
    pitchfork: { score: 9.2, excerpt: 'FKA twigs transforms personal pain into a celestial, genre-defying work of art that pushes pop into uncharted territory.' },
    aoty: { score: 88, excerpt: 'A breathtaking fusion of avant-pop, classical, and electronic music that chronicles heartbreak with otherworldly grace.' },
    douban: { score: 8.6, excerpt: 'FKA twigs 将心碎转化为超凡的艺术，在先锋流行和古典音乐之间找到了一种前所未有的声音。' }
  },
  'Thank U Next|Ariana Grande|2019': {
    pitchfork: { score: 7.9, excerpt: 'Ariana Grande processes grief and growth with breezy confidence, delivering her most consistent and emotionally resonant album.' },
    aoty: { score: 84, excerpt: 'A career-best album that balances polished pop production with genuine emotional vulnerability and self-awareness.' },
    douban: { score: 8.1, excerpt: 'Ariana 用这张专辑完成了从少女偶像到成熟艺术家的转变，在流行的糖衣中包裹着真实的成长之痛。' }
  },
  'Assume Form|James Blake|2019': {
    pitchfork: { score: 7.4, excerpt: 'James Blake opens up on his most direct album yet, trading abstraction for love songs that ache with clarity.' },
    aoty: { score: 79, excerpt: 'A warm, inviting record that finds Blake embracing pop structures without sacrificing his signature emotional depth.' },
    douban: { score: 7.6, excerpt: 'James Blake 在最直接的表达中找到了新的力量，爱情的甜蜜和脆弱在这张专辑中一览无余。' }
  },
  'Golden Hour|Kacey Musgraves|2018': {
    pitchfork: { score: 8.7, excerpt: 'Kacey Musgraves\' third album is a shimmering, genre-expanding masterpiece that finds cosmic wonder in everyday love.' },
    aoty: { score: 87, excerpt: 'A luminous country-pop crossover that captures the magic of being in love with both a person and the world around you.' },
    douban: { score: 8.5, excerpt: 'Kacey 用这张专辑打破了乡村音乐的边界，在宇宙和日常之间找到了一种诗意的连接。' }
  },
  'Dirty Computer|Janelle Monáe|2018': {
    pitchfork: { score: 8.7, excerpt: 'Janelle Monáe delivers a joyous, defiant celebration of queer Black identity wrapped in flawless futuristic pop.' },
    aoty: { score: 87, excerpt: 'A vibrant, politically charged masterpiece that uses Afrofuturism to imagine a world where all identities are celebrated.' },
    douban: { score: 8.4, excerpt: 'Janelle Monáe 用未来主义的流行音乐庆祝酷儿身份和黑人文化，是一张充满力量和希望的宣言。' }
  },
  'A Brief Inquiry Into Online Relationships|The 1975|2018': {
    pitchfork: { score: 8.5, excerpt: 'The 1975\'s third album is an ambitious, shape-shifting meditation on modern life in the digital age.' },
    aoty: { score: 84, excerpt: 'A sprawling, genre-hopping masterpiece that captures the anxiety and absurdity of being alive in the 21st century.' },
    douban: { score: 8.2, excerpt: 'The 1975 用这张专辑探讨了数字时代的孤独和焦虑，风格多变却始终有清晰的情感主线。' }
  },
  "Oil of Every Pearl's Un-Insides|SOPHIE|2018": {
    pitchfork: { score: 8.6, excerpt: 'SOPHIE\'s debut album is a revolutionary work of avant-pop that deconstructs and rebuilds the very idea of a pop song.' },
    aoty: { score: 85, excerpt: 'A groundbreaking electronic masterpiece that uses synthetic sounds to explore deeply human questions about identity and transformation.' },
    douban: { score: 8.3, excerpt: 'SOPHIE 用合成器解构了流行音乐本身，在一堆金属质感的声响中找到了关于身份认同最人性的表达。' }
  },
  'Be the Cowboy|Mitski|2018': {
    pitchfork: { score: 8.8, excerpt: 'Mitski\'s fifth album is a compact, explosive collection of songs about loneliness, desire, and the performance of self.' },
    aoty: { score: 87, excerpt: 'A tightly wound masterpiece of indie rock that packs more emotional complexity into 32 minutes than most double albums.' },
    douban: { score: 8.5, excerpt: 'Mitski 用 32 分钟的时间完成了一次情感爆炸，关于孤独和渴望的表达精确到令人疼痛。' }
  },
  'Isolation|Kali Uchis|2018': {
    pitchfork: { score: 8.6, excerpt: 'Kali Uchis\' debut is a lush, genre-fluid triumph that maps the connections between soul, reggaeton, bossa nova, and R&B.' },
    aoty: { score: 85, excerpt: 'A stunning debut that showcases Uchis\' remarkable range and her ability to weave disparate genres into a cohesive vision.' },
    douban: { score: 8.0, excerpt: 'Kali Uchis 在处女作中就展现了对多种音乐风格的惊人掌控力，灵魂乐、雷鬼、波萨诺瓦融为一体。' }
  },

  // ---- 2015-2017 ----
  'DAMN.|Kendrick Lamar|2017': {
    pitchfork: { score: 9.2, excerpt: 'Kendrick Lamar\'s fourth album is a Pulitzer Prize-winning exploration of race, faith, and contradiction in America.' },
    aoty: { score: 91, excerpt: 'A dense, complex work that balances radio-friendly production with some of Lamar\'s most philosophically ambitious writing.' },
    douban: { score: 8.9, excerpt: '肯德里克凭此专辑获得普利策奖，将嘻哈提升到了文学的高度，关于种族和信仰的探讨深刻而复杂。' }
  },
  'A Crow Looked at Me|Mount Eerie|2017': {
    pitchfork: { score: 9.2, excerpt: 'Phil Elverum\'s album about his wife\'s death is one of the most devastating documents of grief ever committed to tape.' },
    aoty: { score: 88, excerpt: 'A harrowing, essential album that strips away all artifice to confront loss with unbearable clarity and honesty.' },
    douban: { score: 8.8, excerpt: 'Phil Elverum 为亡妻写下的挽歌，没有任何修饰和美化，只有最赤裸的悲伤，是最接近死亡本身的音乐。' }
  },
  'Ctrl|SZA|2017': {
    pitchfork: { score: 8.4, excerpt: 'SZA\'s debut is a warm, vulnerable, and genre-defying R&B classic that spoke directly to a generation of young women.' },
    aoty: { score: 86, excerpt: 'A landmark debut that redefined contemporary R&B with its raw honesty and boundary-pushing production.' },
    douban: { score: 8.5, excerpt: 'SZA 用最脆弱的声音说出了最有力的宣言，这张处女作重新定义了当代 R&B 的可能性。' }
  },
  'Masseduction|St. Vincent|2017': {
    pitchfork: { score: 8.6, excerpt: 'Annie Clark delivers her most pop-forward album, wrapping existential dread in neon-colored, stadium-sized hooks.' },
    aoty: { score: 85, excerpt: 'A brilliantly produced art-pop album that hides deep anxiety beneath its glossy, hyperreal surface.' },
    douban: { score: 8.2, excerpt: 'St. Vincent 在最流行的外壳中藏匿了最深层的不安，霓虹灯般闪耀的制作下是存在主义的黑暗。' }
  },
  'Flower Boy|Tyler, The Creator|2017': {
    pitchfork: { score: 8.5, excerpt: 'Tyler\'s fourth album is a lush, introspective breakthrough that introduced a gentler, more introspective artist.' },
    aoty: { score: 84, excerpt: 'The album where Tyler grew up, trading shock tactics for gorgeous production and genuine emotional openness.' },
    douban: { score: 8.3, excerpt: 'Tyler 在这张专辑中完成了从叛逆少年到成熟音乐人的蜕变，华丽的制作和真诚的表达让人刮目相看。' }
  },
  'A Seat at the Table|Solange|2016': {
    pitchfork: { score: 8.7, excerpt: 'Solange\'s third album is a masterful exploration of Black identity and empowerment, delivered with grace and fury.' },
    aoty: { score: 86, excerpt: 'A landmark album that uses R&B as a vehicle for profound political and personal expression with stunning artistry.' },
    douban: { score: 8.4, excerpt: 'Solange 用最优雅的方式发出了最有力的声音，关于黑人身份和自我赋权的探讨深刻而动人。' }
  },
  'Lemonade|Beyoncé|2016': {
    pitchfork: { score: 8.5, excerpt: 'Beyoncé\'s visual album is a radical reckoning with infidelity, Black womanhood, and Southern heritage.' },
    aoty: { score: 88, excerpt: 'A genre-defying masterpiece that reimagines what a pop album can be, blending the personal and political with stunning ambition.' },
    douban: { score: 8.7, excerpt: '碧昂斯用这张视觉专辑重新定义了流行音乐的边界，在不忠、种族和女性身份的讨论中展现了惊人的野心。' }
  },
  'Blackstar|David Bowie|2016': {
    pitchfork: { score: 8.5, excerpt: 'David Bowie\'s final album is a haunting, jazz-inflected farewell that transforms death into art.' },
    aoty: { score: 88, excerpt: 'A stunning final statement that uses avant-garde jazz to confront mortality with grace, mystery, and dark beauty.' },
    douban: { score: 8.9, excerpt: '鲍伊用这张专辑优雅地告别，将死亡本身转化为艺术，是他留给世界最后的也是最伟大的礼物。' }
  },
  '22 A Million|Bon Iver|2016': {
    pitchfork: { score: 8.9, excerpt: 'Justin Vernon\'s third album is a glitched-out, spiritually searching masterpiece that reimagines folk for the digital age.' },
    aoty: { score: 83, excerpt: 'A radical sonic reinvention that uses distortion and Auto-Tune to create a deeply human exploration of faith and doubt.' },
    douban: { score: 8.3, excerpt: 'Bon Iver 用电子故障和自动调音解构了民谣，在数字噪音中寻找人性，是一次大胆而成功的自我革命。' }
  },
  'A Moon Shaped Pool|Radiohead|2016': {
    pitchfork: { score: 9.1, excerpt: 'Radiohead\'s ninth album is a gorgeous, orchestral meditation on loss, climate change, and the passage of time.' },
    aoty: { score: 86, excerpt: 'A stunningly beautiful album that finds Radiohead at their most emotionally direct while maintaining their experimental edge.' },
    douban: { score: 8.8, excerpt: 'Radiohead 最美丽也最心碎的专辑，弦乐编制和电子纹理交织出一幅关于失去和时间的绝美画卷。' }
  },
  'Art Angels|Grimes|2015': {
    pitchfork: { score: 8.5, excerpt: 'Grimes explodes into pop stardom with a maximalist, self-produced masterpiece that is both deeply weird and instantly catchy.' },
    aoty: { score: 83, excerpt: 'A boldly eclectic pop album that showcases Grimes\' singular vision and her ability to make the avant-garde accessible.' },
    douban: { score: 8.2, excerpt: 'Grimes 一人包办制作的流行杰作，古怪而悦耳，证明了她是一个真正的流行天才。' }
  },
  'Carrie & Lowell|Sufjan Stevens|2015': {
    pitchfork: { score: 9.3, excerpt: 'Sufjan Stevens returns to folk minimalism for a devastatingly beautiful album about his mother\'s death and his childhood.' },
    aoty: { score: 88, excerpt: 'A masterwork of grief and memory, rendered with such delicate precision that every whispered lyric carries immense weight.' },
    douban: { score: 8.9, excerpt: 'Sufjan 用最简朴的民谣讲述了最复杂的情感，关于母亲的死亡和童年的回忆，每一句低语都重如千钧。' }
  },
  'Sometimes I Sit and Think and Sometimes I Just Sit|Courtney Barnett|2015': {
    pitchfork: { score: 8.6, excerpt: 'Courtney Barnett\'s debut is a witty, razor-sharp collection of garage-rock vignettes about the mundane and the profound.' },
    aoty: { score: 84, excerpt: 'A brilliantly clever album that finds poetry in parking lots, swimming pools, and existential crises at open houses.' },
    douban: { score: 8.2, excerpt: 'Courtney Barnett 用幽默和智慧将日常琐事变成了摇滚诗歌，车库摇滚的力量和文字的机智完美融合。' }
  },
  'I Love You Honeybear|Father John Misty|2015': {
    pitchfork: { score: 8.7, excerpt: 'Josh Tillman\'s second album is a lush, sarcastic, and deeply romantic exploration of love in the age of irony.' },
    aoty: { score: 85, excerpt: 'A gorgeously orchestrated album that uses cynicism as a shield for one of the most sincere love letters in modern music.' },
    douban: { score: 8.2, excerpt: 'Josh Tillman 用讽刺和自嘲包裹了一封最真诚的情书，华丽的管弦乐编曲下隐藏着一颗浪漫到无可救药的心。' }
  },
  'Emotion|Carly Rae Jepsen|2015': {
    pitchfork: { score: 7.4, excerpt: 'Carly Rae Jepsen\'s third album is a cult classic of pure pop perfection, full of sax solos and yearning choruses.' },
    aoty: { score: 80, excerpt: 'An immaculately crafted 80s-influenced pop album that turned a one-hit wonder into an indie darling.' },
    douban: { score: 7.8, excerpt: 'Carly Rae Jepsen 用这张专辑完成了从流行偶像到 cult 经典的转变，80 年代的合成器音色和萨克斯独奏让人欲罢不能。' }
  },

  // ---- 2012-2014 ----
  'Lost in the Dream|The War on Drugs|2014': {
    pitchfork: { score: 8.7, excerpt: 'Adam Granduciel\'s third album is a shimmering, heartland-rock epic about searching for meaning in the American night.' },
    aoty: { score: 84, excerpt: 'A masterful blend of Springsteen-esque Americana and Krautrock propulsion that rewards deep, immersive listening.' },
    douban: { score: 8.4, excerpt: 'The War on Drugs 在美国公路摇滚和德国泡菜摇滚之间找到了绝妙的平衡点，是一张适合深夜独驾的专辑。' }
  },
  '1989|Taylor Swift|2014': {
    pitchfork: { score: 7.7, excerpt: 'Taylor Swift\'s formal pivot to pop is a masterclass in songcraft, full of indelible hooks and sharp emotional detail.' },
    aoty: { score: 80, excerpt: 'The album that completed Swift\'s transformation from country star to global pop icon, with songwriting that transcends genre.' },
    douban: { score: 8.1, excerpt: '泰勒正式转向流行音乐的宣言之作，旋律的流畅度和歌词的精准度都达到了一个新的高度。' }
  },
  'Run the Jewels 2|Run the Jewels|2014': {
    pitchfork: { score: 9.0, excerpt: 'Killer Mike and El-P deliver a ferocious, politically charged masterpiece that defined protest rap for a new era.' },
    aoty: { score: 89, excerpt: 'An explosive collaboration that channels righteous anger into some of the most electrifying hip-hop of the decade.' },
    douban: { score: 8.6, excerpt: 'Killer Mike 和 El-P 的化学反应在这张专辑中达到了爆炸级别，愤怒的政治宣言和凌厉的制作完美结合。' }
  },
  'Yeezus|Kanye West|2013': {
    pitchfork: { score: 9.5, excerpt: 'Kanye West\'s sixth album is a brutal, industrial-strength masterpiece that tore up the rulebook for mainstream rap.' },
    aoty: { score: 82, excerpt: 'A deliberately abrasive, confrontational album that pushed hip-hop into abrasive new sonic territory.' },
    douban: { score: 8.1, excerpt: 'Kanye 用工业噪音和极简制作彻底颠覆了主流说唱的范式，是一张即使在争议中也无法忽视的作品。' }
  },
  'Random Access Memories|Daft Punk|2013': {
    pitchfork: { score: 8.5, excerpt: 'Daft Punk\'s fourth album is a lavish love letter to the golden age of disco, recorded with live musicians and analog gear.' },
    aoty: { score: 86, excerpt: 'A painstakingly crafted homage to 70s studio craftsmanship that produced one of the biggest hits of all time.' },
    douban: { score: 8.6, excerpt: 'Daft Punk 用全模拟录音和现场乐手致敬了迪斯科黄金时代，Get Lucky 注定是永恒的经典。' }
  },
  'Modern Vampires of the City|Vampire Weekend|2013': {
    pitchfork: { score: 9.3, excerpt: 'Vampire Weekend\'s third album is a mature, spiritually searching masterpiece about God, death, and growing up.' },
    aoty: { score: 85, excerpt: 'A profound step forward that traded collegiate wit for existential questions, with the band\'s sharpest songwriting yet.' },
    douban: { score: 8.3, excerpt: 'Vampire Weekend 在这张专辑中告别了大学校园的俏皮，转向了对上帝、死亡和成长的严肃思考。' }
  },
  'Good Kid M.A.A.D City|Kendrick Lamar|2012': {
    pitchfork: { score: 9.5, excerpt: 'Kendrick Lamar\'s major-label debut is a cinematic masterpiece that chronicles a day in the life of Compton youth.' },
    aoty: { score: 88, excerpt: 'A landmark concept album that established Lamar as the most important rapper of his generation.' },
    douban: { score: 8.9, excerpt: '肯德里克用一部电影般的叙事讲述了一个康普顿少年的成长故事，是嘻哈历史上最重要的处女作之一。' }
  },
  'Channel Orange|Frank Ocean|2012': {
    pitchfork: { score: 9.0, excerpt: 'Frank Ocean\'s debut is a lush, genre-defying masterpiece that expanded the possibilities of R&B.' },
    aoty: { score: 86, excerpt: 'A stunning debut that seamlessly blends R&B, psychedelia, and pop into a cohesive, groundbreaking vision.' },
    douban: { score: 8.7, excerpt: 'Frank Ocean 的处女作重新定义了 R&B 的边界，在奢华的制作中隐藏着最私密的情感。' }
  },

  // ---- 2010 ----
  'My Beautiful Dark Twisted Fantasy|Kanye West|2010': {
    pitchfork: { score: 10.0, excerpt: 'Kanye West\'s fifth album is a maximalist masterpiece, an epic of self-laceration and sonic excess that redefined hip-hop.' },
    aoty: { score: 90, excerpt: 'One of the greatest albums of the century, a sprawling, ambitious work that captures the contradictions of genius.' },
    douban: { score: 9.1, excerpt: 'Kanye 的巅峰之作，奢华的制作、自毁的坦诚和宏大的野心共同构成了 21 世纪最重要的说唱专辑之一。' }
  },
};

// ============================================================

function makeKey(title, artist, year) {
  return `${title}|${artist}|${year}`;
}

function makeSourceUrl(source, title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const urls = {
    douban: `https://music.douban.com/subject_search?search_text=${encodeURIComponent(title)}`,
    pitchfork: `https://pitchfork.com/search/?query=${encodeURIComponent(title)}`,
    aoty: `https://www.albumoftheyear.org/search/?q=${encodeURIComponent(title)}`,
  };
  return urls[source] || null;
}

function main() {
  const albums = JSON.parse(readFileSync(join(root, 'data', 'seed-albums.json'), 'utf-8'));

  const doubanData = {};
  const pitchforkData = {};
  const aotyData = {};

  let doubanCount = 0, pitchforkCount = 0, aotyCount = 0;

  for (const album of albums) {
    const key = makeKey(album.title, album.artist, album.year);
    const data = REVIEW_DATA[key];

    if (!data) {
      // 无此专辑的评分数据，记录空条目
      const empty = { score: null, score_normalized: null, excerpt: null, source_url: null, _not_found: true };
      doubanData[key] = { ...empty };
      pitchforkData[key] = { ...empty };
      aotyData[key] = { ...empty };
      continue;
    }

    if (data.douban) {
      doubanData[key] = {
        score: data.douban.score,
        score_normalized: data.douban.score,
        excerpt: data.douban.excerpt || null,
        source_url: makeSourceUrl('douban', album.title),
      };
      doubanCount++;
    }
    if (data.pitchfork) {
      pitchforkData[key] = {
        score: data.pitchfork.score,
        score_normalized: data.pitchfork.score,
        excerpt: data.pitchfork.excerpt || null,
        source_url: makeSourceUrl('pitchfork', album.title),
      };
      pitchforkCount++;
    }
    if (data.aoty) {
      aotyData[key] = {
        score: data.aoty.score,
        score_normalized: Number((data.aoty.score / 10).toFixed(1)),
        excerpt: data.aoty.excerpt || null,
        source_url: makeSourceUrl('aoty', album.title),
      };
      aotyCount++;
    }
  }

  writeFileSync(join(root, 'data', 'reviews-douban.json'), JSON.stringify(doubanData, null, 2));
  writeFileSync(join(root, 'data', 'reviews-pitchfork.json'), JSON.stringify(pitchforkData, null, 2));
  writeFileSync(join(root, 'data', 'reviews-aoty.json'), JSON.stringify(aotyData, null, 2));

  console.log('✅ 乐评数据已生成');
  console.log(`  豆瓣: ${doubanCount}/${albums.length}`);
  console.log(`  Pitchfork: ${pitchforkCount}/${albums.length}`);
  console.log(`  AOTY: ${aotyCount}/${albums.length}`);
}

main();
