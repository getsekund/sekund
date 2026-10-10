import { ILLUSTRATION } from "@/brand/illustrations";
import { Dither } from "@/dither/Dither";
import { bands, fade, horizon, pulse } from "@/dither/fields";
import { DotText } from "@/ui/DotText";
import { HeroWatch } from "@/ui/HeroWatch";
import { ApproveDiagram, BuildDiagram, ParseDiagram, SignDiagram } from "@/ui/HowDiagrams";
import { Knock } from "@/ui/Knock";
import { fitAffine } from "@/ui/affine";
import { ApprovePage } from "@/ui/LcdApprove";
import { Shot, Step } from "@/ui/pieces";
import { EARLIER_TX, PROOF_TX, REPO_URL, explorerUrl, shortKey } from "./facts";
import type { Slide } from "./types";

const STAGE_W = 1920;
const STAGE_H = 1080;

/**
 * The hero illustration sits in the same box on the first and the last slide, so the two bookend
 * the deck. It is drawn into the full-bleed field on one canvas, so the case meets the dots with
 * no rectangular edge; the box runs past the top and bottom so the strap leaves the frame.
 */
const HERO = { x: STAGE_W - 80 - 830, y: -30, width: 830, height: 1140 };

/** Next 90 days: where the paper panel with the ask begins; the plan and the target render sit on the black to its left. */
const PAPER_X = 1140;
/** Gap between the plan column and the paper edge, and the inset of the ask inside the paper. */
const PAPER_GAP = 128;
const PAPER_PAD = 80;
/**
 * The target render: a square image on the black ground, under the plan, its strap leaving the
 * frame at the bottom. It is clipped to the black panel, so its ground never crosses onto the paper.
 * In the 1024 px image the case spans x 0.32–0.71 and y 0.26–0.67, the buckle reaches x 0.85.
 */
const RENDER = { size: 900, left: 340, top: 430 };
/** Corners of the render's LCD window in its 1024 px space, clockwise from top left, fitted from the panel edges. */
const RENDER_LCD: readonly (readonly [number, number])[] = [
  [387.67, 414.32],
  [589.28, 437.5],
  [570.63, 591.31],
  [370.32, 568.61],
];
/**
 * The page is drawn into the window at the simulator's own proportions: the window is wider than
 * the simulator's, so the box is the page's height (136–322 in window units, plus a margin) and
 * the window's aspect, centred on the page.
 */
const RENDER_LCD_BOX = { x: 48.3, y: 128, w: 263.4, h: 202 };
/** Caption sits beside the case, right-aligned 44 px short of the left pushers (x 0.258 of the image). */
const RENDER_CAPTION_RIGHT = STAGE_W - (RENDER.left + RENDER.size * 0.258 - 44);

/**
 * Shipped slide: the simulator capture runs the full height of the stage, so the strap leaves the
 * frame at the slide edges the way the hero does. It is 1860x2612, so 769 wide at stage height;
 * the case ends 27 px inside its right edge, which puts the case on the right margin.
 */
const CAPTURE_RIGHT = 84;
const CAPTURE_TEXT_W = 920;

/** Team slide: the two founder blocks stop where the problem slide's copy does, short of the field on the right. */
const TEAM_W = 1060;

/** Proof slide: both captures share one height, so their top and bottom edges line up. */
const PROOF_H = 454;
const PROOF_LCD_W = 373;
const PROOF_EXPLORER_W = 1267;

export const SLIDES: readonly Slide[] = [
  {
    id: "claim",
    title: "Claim",
    notes: [
      "Jedna rečenica, pa stani. Hardverski novčanik koji nosiš: običan sat od smole koji potpisuje Solanu, sam pročita poruku koju potpisuje, prikaže iznos i primaoca iz tih bajtova, i potpiše tek posle odobrenja na satu. Ključ nikad ne stiže do aplikacije na telefonu.",
      "Rečnik: na slajdovima piše phone app; u kodu, repou i ovim beleškama to je companion aplikacija, ista stvar. Izgovori phone app.",
      "Ne reci jeftin (nemamo BOM), ne reci prvi ni jedinstven (nosivi potpisnici postoje). Ne reci da je ključ već u hardveru ili na fizičkom zglobu: ovo je softverski dokaz, kućište, dugme, Bluetooth i čip su plan.",
      "Sve ostalo u prezentaciji je dokaz ove rečenice. Ne objašnjavaj još ništa; pusti sliku sata da stoji dve sekunde.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <HeroWatch spec={ILLUSTRATION} width={STAGE_W} height={STAGE_H} box={HERO} field={pulse} cell={5} feather={7} animate={active} fps={16} reveal={active ? 900 : 0} />
        </div>
        <div className="slide__body">
          <div className="hero-copy hero-copy--solo">
            <Knock as="h1" className="claim">
              A hardware wallet
              <br />
              you wear.
            </Knock>
            <p className="lead">
              <span className="plate plate--inverse">
                A simple resin watch that signs Solana.
                <br />
                The key never reaches the phone app.
              </span>
            </p>
          </div>
        </div>
      </>
    ),
  },

  {
    id: "problem",
    title: "Problem",
    notes: [
      "Hardverski novčanik čuva ključ, ali traži drugi predmet. Taj predmet je u fioci kad transakcija stigne na telefon.",
      "Zato ljudi potpisuju na telefonu, gde je ključ izložen aplikacijama, ili ne potpisuju uopšte.",
      "Sat je već na ruci. Ne tražimo novu naviku; koristimo onu koja postoji. Pauza posle poslednjeg reda.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <div style={{ position: "absolute", left: 1240, top: 0, width: 680, height: STAGE_H }}>
            <Dither width={680} height={STAGE_H} cell={5} field={fade} animate={active} fps={12} />
          </div>
        </div>
        <div className="slide__body slide__body--quiet">
          <h2 className="title" style={{ maxWidth: 1100 }}>
            Hardware wallets are
            <br />a second object.
          </h2>
          <ul className="list" style={{ maxWidth: 1060 }}>
            <li>People don&rsquo;t carry them.</li>
            <li>So they sign on the phone, beside every other app, or they don&rsquo;t sign at all.</li>
          </ul>
          <p className="lead">
            <span className="plate plate--inverse">The watch is already on.</span>
          </p>
        </div>
      </>
    ),
  },

  {
    id: "proof",
    title: "Proof",
    notes: [
      `Na slajdu su samo naslov i dve slike; sve činjenice izgovori. Levo je simulator na poslednjoj stranici pregleda, APPROVE?, dugme D odobrava. Desno je sažetak iz Solana Explorera, devnet: Status Success, fee payer i jedini potpisnik je ključ simulatora, ${shortKey(PROOF_TX.signer)}.`,
      `Ovo je devnet transakcija potvrđena 8. oktobra 2026: prenos ${PROOF_TX.amountSol} SOL sa adrese simulatora ${shortKey(PROOF_TX.signer)} na ${shortKey(PROOF_TX.destination)}. Companion je proverio potpis pre slanja. Ceo zapis: ${explorerUrl(PROOF_TX.signature)}`,
      "Reci glasno: u ovom dokazu secure element je softver, Web Worker sa Ed25519 ključem koji se ne može izvesti, a sat je simulator u pregledaču. Potpis je pravi Ed25519 i lanac ga je prihvatio. Ne reci da je čip već u kućištu, ni da je ključ na fizičkom zglobu.",
      "Rečenica za sudije: simulator prikazuje tačno ono što potpisuje, potpisuje samo posle radnje odobrenja na satu, i devnet je to prihvatio. Sve tri su proverljive, u Exploreru i u repou.",
      `Ako traže drugi primer: ranija potvrda ${shortKey(EARLIER_TX.signature)}, ${EARLIER_TX.amountSol} SOL sa adrese ${shortKey(EARLIER_TX.signer)}, takođe potpisana u simulatoru. ${explorerUrl(EARLIER_TX.signature)}`,
    ],
    render: () => (
      <div className="slide__body slide__body--quiet">
        <h2 className="title">
          Signed in the simulator. <span className="dim">Accepted on devnet.</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: `${PROOF_LCD_W}px 1fr`, gap: 56, alignItems: "start" }}>
          <Shot src="/assets/lcd-approve.png" alt="The watch simulator's LCD on the APPROVE? page with the countdown" width={PROOF_LCD_W} height={PROOF_H} />
          <Shot src="/assets/explorer-rows.png" alt="Solana Explorer summary of the confirmed devnet transaction: success, signature, fee payer, slot, timestamp" width={PROOF_EXPLORER_W} height={PROOF_H} />
        </div>
      </div>
    ),
  },

  {
    id: "how",
    title: "How it works",
    notes: [
      "Četiri koraka, na slajdu samo naslovi; detalje izgovori. Phone app (companion) pravi transakciju odmah posle blockhash-a i šalje tačne bajtove poruke. Sat sam parsira tu poruku i prikazuje iznos i primaoca pročitane iz bajtova koje će potpisati, ne iz polja koja je aplikacija poslala pored njih. To je razlika koju pokazujemo.",
      "PIN otvara sesiju; odobrenje je posebna radnja na satu, u simulatoru dugme D, na hardveru fizičko dugme. Secure element vraća Ed25519 potpis nad istim neheširanim bajtovima; companion ga proveri, sastavi transakciju i emituje. Ključ nikad ne stiže do aplikacije na telefonu; na hardverskoj meti ostaje u secure elementu, to izgovori uz poslednji red. Tri pogrešna PIN-a brišu ključ.",
      "Granica poverenja, ako pitaju: secure element čuva ključ i potpisuje bajtove koje mu firmver pošalje; firmver sata odlučuje šta se prikazuje i kad se potpisuje. Zato pre bilo kakve tvrdnje o hardverskoj bezbednosti idu secure boot, zaključan debug port i šifrovan kanal ka čipu. U ovom dokazu tu ulogu igra Web Worker sa istim interfejsom koji će imati drajver.",
      "Za pitanja: pre prikaza sat odbija replay, istekle zahteve, poruke veće od limita čipa, durable nonce, lookup tabele (v0) i sve što nije jedan System Program transfer sa sopstvene adrese. Odobrenje izdaje jednokratni token vezan za tačne bajtove, važi pet sekundi. Dva profila čipa u kodu: TROPIC01 (4096 bajtova, little-endian) i SE050E (919 bajtova, big-endian). Link je lokalni relay umesto Bluetootha; skidanje sa ruke odmah zatvara sesiju.",
      "Ako pomenu druge nosive potpisnike (SolWear, ESP32 sa NFC-om, je na Colosseumu): da, postoje, ne tvrdimo da smo prvi. Razlika je u ovom koraku dva: mi parsiramo poruku i prikazujemo iz bajtova koje potpisujemo; ne prikazujemo polja koja aplikacija pošalje odvojeno od bajtova. Bez omalovažavanja, samo činjenica iz koda.",
    ],
    render: () => (
      <div className="slide__body slide__body--dense">
        <h2 className="title">How it works.</h2>
        <div className="cols" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          <Step n="1" figure={<BuildDiagram />} title="Phone app builds the transaction" />
          <Step n="2" figure={<ParseDiagram />} title="Watch parses the bytes it signs" />
          <Step n="3" figure={<ApproveDiagram />} title="PIN, then a separate approve" />
          <Step n="4" figure={<SignDiagram />} title="Signature returns; phone app broadcasts" />
        </div>
        <p className="lead foot">
          <span className="plate plate--inverse">The key never reaches the phone app.</span>
        </p>
      </div>
    ),
  },

  {
    id: "solana",
    title: "Why Solana",
    notes: [
      "Tri razloga. Ed25519 je nativan: čip potpisuje tačno one bajtove koje prikazuje, bez dodatnog heširanja i bez druge krive.",
      "Potvrda je dovoljno brza: čitav krug, zahtev, pregled na satu, pritisak, emitovanje, staje u životni vek blockhash-a, sa rezervom za slanje; companion drži tu rezervu i, ako istekne, traži novi blockhash i novi pregled.",
      "Treći razlog: telefon koji korisnik već ima, Android prvo. Phone app (companion) je wallet aplikacija na telefonu ili laptopu i priča sa satom preko Bluetooth LE; na Androidu dApp-ovi do nje stižu kroz Mobile Wallet Adapter, a sat je potpisnik iza nje. iOS je kasnija nativna aplikacija. Seeker je kanal distribucije, ne zavisnost.",
      "Zašto Android prvo, ako pitaju: companion je web aplikacija i koristi Web Bluetooth, koji radi u Chrome-u na Androidu i na desktopu. U iOS Safariju Web Bluetooth ne postoji, pa je iOS kasnija nativna aplikacija preko Core Bluetootha. To nije tvrdnja za ovaj build i nema veze sa Seekerom. U ovom dokazu Bluetooth je lokalni link; uparivanje je u planu za 90 dana. Ako pitaju za Ethereum: druga kriva (secp256k1), roadmap, ne ovaj build.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <div style={{ position: "absolute", left: 0, bottom: 0, width: STAGE_W, height: 300 }}>
            <Dither width={STAGE_W} height={300} cell={6} field={horizon} animate={active} fps={12} />
          </div>
        </div>
        <div className="slide__body slide__body--quiet" style={{ paddingBottom: 300 }}>
          <h2 className="title">Why Solana.</h2>
          <div className="cols" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 56 }}>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Native Ed25519</h3>
              <p className="body">Signs the bytes it shows. No hashing, no second curve.</p>
            </div>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Fast confirmation</h3>
              <p className="body">A wrist approval fits in a blockhash&rsquo;s lifetime.</p>
            </div>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Android first</h3>
              <p className="body">The phone app is the wallet; the watch signs. iOS later.</p>
            </div>
          </div>
        </div>
      </>
    ),
  },

  {
    id: "business",
    title: "Business",
    notes: [
      "Bez brojeva. Prodajemo sat; phone app (companion) je besplatan. Ovo je slajd o poslu, ne o planu: ko kupuje prvi i kako nas nalazi.",
      "Ko kupuje prvi: ljudi na Solani koji drže prava sredstva u sopstvenom čuvanju i potpisuju svaki dan. Njima je hardverski novčanik u fioci stvaran problem, i oni već plaćaju za potpisnik.",
      "Kako nas nalaze: kroz wallet-e koji nas prikažu kao podržanog potpisnika (Wallet Standard adapter, pa postojeći wallet-i), zatim kroz Solana Mobile dApp Store. Seeker je kanal, ne zavisnost: companion je Android prvo, na bilo kom Android telefonu sa Chrome-om; iOS je kasnija nativna aplikacija.",
      "Redosled naplate, ako pitaju: pre-orderi sa povratnim depozitom tek kad radi hardver, ne pre. White-label za berze i custody deskove tek posle pravog secure elementa, secure boot-a i eksterne revizije; pre toga ga ne nudimo.",
      "Ako pitaju za cenu, BOM ili tiraž: to još nemamo i nećemo izmišljati.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <div style={{ position: "absolute", left: 1320, top: 0, width: 600, height: STAGE_H }}>
            <Dither width={600} height={STAGE_H} cell={6} field={bands} animate={active} fps={10} />
          </div>
        </div>
        <div className="slide__body slide__body--quiet" style={{ paddingRight: 640 }}>
          <h2 className="title">
            We sell the watch.
            <br />
            The phone app is free.
          </h2>
          <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div className="card">
              <h3 className="sub">Who buys first</h3>
              <p className="mono">Solana users who keep funds in self-custody and sign every day.</p>
            </div>
            <div className="card">
              <h3 className="sub">How they find it</h3>
              <p className="mono">Wallets that list SEKUND as a signer. Then the Solana Mobile dApp Store.</p>
            </div>
          </div>
        </div>
      </>
    ),
  },

  {
    id: "team",
    title: "Team",
    notes: [
      "Dvoje. Jedan red po osobi, bez biografije, bez brojeva, bez imena agencije. Goran: dizajner proizvoda i developer, vodi agenciju za proizvode; razvoj proizvoda za Motif, Twilight i BitDSM. Srdjan: front-end developer.",
      "Ako pitaju ko je šta uradio u SEKUND-u: Goran vodi proizvod i inženjering; Srdjanovu ulogu opiši onako kako ste se dogovorili, ne nabrajaj delove koda umesto njega. Ne izmišljaj klijente, tiraže ni godine.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <div style={{ position: "absolute", left: 1240, top: 0, width: 680, height: STAGE_H }}>
            <Dither width={680} height={STAGE_H} cell={5} field={fade} animate={active} fps={12} />
          </div>
        </div>
        <div className="slide__body slide__body--quiet">
          <h2 className="title">Team.</h2>
          <div className="col" style={{ gap: 56, maxWidth: TEAM_W }}>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Goran Petkovic</h3>
              <p className="body">Product designer and developer; runs a product agency. Product development for Motif, Twilight and BitDSM.</p>
            </div>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Srdjan Solajic</h3>
              <p className="body">Front-end developer.</p>
            </div>
          </div>
        </div>
      </>
    ),
  },

  {
    id: "next",
    title: "Next 90 days and the ask",
    notes: [
      "Levo je obećanje, desno molba. Jedan radni prototip za 90 dana: TROPIC01 drži ključ, nRF52840 vodi ekran, dugmad i Bluetooth, upari se sa Android telefonom, oporavak ide kroz Squads trezor. Ništa od toga još ne postoji; danas potpisuje simulator. Slika dole je render ciljanog dizajna, ne fotografija; LCD na njemu je pravi ekran simulatora, stranica APPROVE?.",
      "Kako to proveravamo: taj jedan prototip ide u ruke ljudima koji svaki dan potpisuju na Solani i sami čuvaju ključeve; gledamo da li ga nose i da li potpisuju sa njega. Ne reci deset, ne reci serija, ne reci tiraž.",
      "Tražimo tri stvari: mesto u akceleratoru, hardverskog partnera za kućište (na slajdu piše samo hardverski partner; kućište izgovori), i uvod kod Solana Mobile. Izgovori sve tri, pa stani.",
    ],
    render: () => (
      <>
        <div className="slide__bg">
          <div className="paper" style={{ position: "absolute", left: PAPER_X, top: 0, right: 0, bottom: 0 }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: PAPER_X, height: STAGE_H, overflow: "hidden" }}>
            <img
              src="/assets/watch-target-render.png"
              alt="Render of the target SEKUND design: a matte black resin watch showing the APPROVE? page"
              style={{ position: "absolute", left: RENDER.left, top: RENDER.top, width: RENDER.size, height: RENDER.size }}
            />
            <svg
              width={RENDER_LCD_BOX.w}
              height={RENDER_LCD_BOX.h}
              viewBox={`${RENDER_LCD_BOX.x} ${RENDER_LCD_BOX.y} ${RENDER_LCD_BOX.w} ${RENDER_LCD_BOX.h}`}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                overflow: "visible",
                transformOrigin: "0 0",
                transform: fitAffine(
                  [
                    [0, 0],
                    [RENDER_LCD_BOX.w, 0],
                    [RENDER_LCD_BOX.w, RENDER_LCD_BOX.h],
                    [0, RENDER_LCD_BOX.h],
                  ],
                  RENDER_LCD.map(([x, y]) => [RENDER.left + (x * RENDER.size) / 1024, RENDER.top + (y * RENDER.size) / 1024] as const),
                ),
              }}
            >
              <ApprovePage />
            </svg>
          </div>
          <p className="caption" style={{ position: "absolute", right: RENDER_CAPTION_RIGHT, bottom: 112 }}>
            Target design, render.
          </p>
        </div>
        <div className="slide__body" style={{ display: "grid", gridTemplateColumns: `${PAPER_X - 112 - PAPER_GAP}px 1fr`, columnGap: PAPER_GAP + PAPER_PAD, alignContent: "start" }}>
          <div className="col" style={{ gap: 56 }}>
            <h2 className="title">
              One working prototype
              <br />
              in 90 days.
            </h2>
            <ul className="list">
              <li>TROPIC01 holds the key</li>
              <li>nRF52840 runs the screen, buttons, Bluetooth</li>
              <li>Pairs with Android</li>
              <li>Squads vault recovery</li>
            </ul>
          </div>
          <div className="col on-paper" style={{ gap: 56 }}>
            <h2 className="title">The ask.</h2>
            <ul className="list">
              <li>A place in the accelerator</li>
              <li>A hardware partner</li>
              <li>A Solana Mobile introduction</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },

  {
    id: "recovery",
    title: "Recovery",
    notes: [
      "Ključ koji ne napušta sat postavlja pitanje: šta kad sat nestane? Odgovor nije seed fraza na papiru.",
      "SEKUND je jedan potpisnik u Squads multisig trezoru, ili je uparen sa drugim satom. Izgubljen sat se zamenjuje i uklanja iz trezora; sredstva ostaju. Tri kartice izgovori: SEKUND je prvi potpisnik, sat; drugi ključ je drugi sat ili ključ koji korisnik već drži; sredstva žive u Squads trezoru, ne na jednom uređaju.",
      "Reci jasno: ovo je dizajn oporavka, ne nešto što je isporučeno. Squads integracija ne radi u demou; tok oporavka je stavka u planu za 90 dana. Ako pitaju za detalje, odgovor je: drugi potpisnik je ili drugi upareni sat ili ključ koji korisnik već drži, a trezor je Squads multisig na Solani.",
    ],
    render: () => (
      <div className="slide__body slide__body--dense">
        <h2 className="title">Lose the watch, not the funds.</h2>
        <p className="lead">
          SEKUND is one signer in a Squads vault.
          <br />A lost watch is replaced; the funds stay.
        </p>
        <p className="small dim">The recovery design. In the 90-day plan, not the demo.</p>
        <div className="equation">
          <div className="card card--centered">
            <DotText text="SEKUND" dot={6} />
          </div>
          <span className="op">+</span>
          <div className="card card--centered">
            <DotText text="SECOND KEY" dot={6} />
          </div>
          <span className="op">=</span>
          <div className="card card--centered on-paper">
            <DotText text="SQUADS VAULT" dot={6} />
          </div>
        </div>
      </div>
    ),
  },

  {
    id: "shipped",
    title: "Shipped this week",
    notes: [
      "Na slajdu su četiri reda. Delove jezgra izgovori, nisu ispisani: parser poruke, čuvar zahteva sa allowlist-om, PIN sesija i jednokratni token za odobrenje.",
      "Potvrđena devnet transakcija potpisana u simulatoru sata. Slika je 3D simulator sa živim LCD-om. Aplikacija na telefonu pravi transakciju, proverava potpis i emituje. Dva profila čipa su u kodu, TROPIC01 i SE050E; sami čipovi, kućište, dugme i Bluetooth su plan. Testovi pokrivaju put od parsera do klika na 3D dugme. Repo je na GitHubu, Apache-2.0; reci da je javan samo ako je prebačen na public pre pitcha (10. oktobra je još privatan).",
      "Imena su na slajdu Tim (7), ne ovde. Dvoje ljudi, jedna nedelja.",
    ],
    render: () => (
      <>
        <div className="slide__bg">
          <img
            src="/assets/watch-sim-3d.png"
            alt="The 3D watch simulator in the browser, dark theme, turned to a three-quarter view, showing the clock face"
            style={{ position: "absolute", top: 0, right: CAPTURE_RIGHT, height: STAGE_H, width: "auto" }}
          />
          <p className="caption" style={{ position: "absolute", left: 112, bottom: 112 }}>
            3D simulator, live LCD.
          </p>
        </div>
        <div className="slide__body slide__body--dense">
          <h2 className="title">Shipped this week.</h2>
          <ul className="list" style={{ gap: 36, maxWidth: CAPTURE_TEXT_W }}>
            <li>Signing core, with a PIN and a separate approve</li>
            <li>A devnet transaction, signed in the simulator</li>
            <li>A phone app that builds, verifies and broadcasts</li>
            <li>The chips are roadmap</li>
          </ul>
        </div>
      </>
    ),
  },

  {
    id: "close",
    title: "Close",
    notes: [
      "Ponovi rečenicu, pa onu za sudije, pa molbu, pa stani. Hardverski novčanik koji nosiš; običan sat od smole koji potpisuje Solanu; ključ nikad ne stiže do aplikacije na telefonu.",
      "Za sudije: simulator prikazuje tačno ono što potpisuje, potpisuje samo posle radnje odobrenja na satu, i devnet je to prihvatio. Sve tri su proverljive, u Exploreru i u repou.",
      "Tražimo akcelerator, hardverskog partnera za kućište i uvod kod Solana Mobile. Repo je na GitHubu, Apache-2.0. Hvala.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <HeroWatch spec={ILLUSTRATION} width={STAGE_W} height={STAGE_H} box={HERO} field={pulse} cell={5} feather={7} animate={active} fps={16} variant="approve" reveal={active ? 900 : 0} />
        </div>
        <div className="slide__body">
          <div className="hero-copy">
            <Knock as="h2" className="claim">
              A hardware wallet
              <br />
              you wear.
            </Knock>
            <p className="lead">
              <span className="plate plate--inverse">
                A simple resin watch that signs Solana.
                <br />
                The key never reaches the phone app.
              </span>
            </p>
            <Knock as="p" className="body">
              Fund SEKUND: accelerator, a hardware partner, Solana Mobile.
            </Knock>
          </div>
          <p className="small foot">
            <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">
              <Knock>github.com/getsekund/sekund</Knock>
            </a>
          </p>
        </div>
      </>
    ),
  },
];

export const SLIDE_IDS: readonly string[] = SLIDES.map((slide) => slide.id);
