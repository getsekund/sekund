import { ILLUSTRATION } from "@/brand/illustrations";
import { Dither } from "@/dither/Dither";
import { bands, fade, horizon, pulse } from "@/dither/fields";
import { DotText } from "@/ui/DotText";
import { HeroWatch } from "@/ui/HeroWatch";
import { ApproveDiagram, BuildDiagram, ParseDiagram, SignDiagram } from "@/ui/HowDiagrams";
import { Knock } from "@/ui/Knock";
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
/** The target render: a square image on the black ground, under the plan, its strap leaving the frame at the bottom. */
const RENDER = { size: 760, left: 420, top: 520 };

/**
 * Shipped slide: the simulator capture runs the full height of the stage, so the strap leaves the
 * frame at the slide edges the way the hero does. It is 1860x2612, so 769 wide at stage height;
 * the case ends 27 px inside its right edge, which puts the case on the right margin.
 */
const CAPTURE_RIGHT = 84;
const CAPTURE_TEXT_W = 920;

/** Proof slide: both captures share one height, so their top and bottom edges line up. */
const PROOF_H = 454;
const PROOF_LCD_W = 373;
const PROOF_EXPLORER_W = 1267;

export const SLIDES: readonly Slide[] = [
  {
    id: "claim",
    title: "Claim",
    notes: [
      "Jedna rečenica, pa stani. Proveri i potpiši Solanu na ruci: običan sat od smole koji sam pročita poruku koju potpisuje, prikaže iznos i primaoca iz tih bajtova, i potpiše tek posle odobrenja na satu. Ključ nikad ne stiže do companion aplikacije.",
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
              Verify and sign
              <br />
              Solana on-wrist.
            </Knock>
            <p className="lead">
              <span className="plate plate--inverse">
                A simple resin watch.
                <br />
                The key never reaches the companion.
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
      "Četiri koraka, bez detalja. Companion pravi transakciju odmah posle blockhash-a i šalje tačne bajtove poruke. Sat sam parsira tu poruku i prikazuje iznos i primaoca pročitane iz bajtova koje će potpisati, ne iz polja koja je aplikacija poslala pored njih. To je razlika koju pokazujemo.",
      "PIN otvara sesiju; odobrenje je posebna radnja na satu, u simulatoru dugme D, na hardveru fizičko dugme. Secure element vraća Ed25519 potpis nad istim neheširanim bajtovima; companion ga proveri, sastavi transakciju i emituje. Ključ nikad ne stiže do companiona; na hardverskoj meti ostaje u secure elementu. Tri pogrešna PIN-a brišu ključ.",
      "Granica poverenja, ako pitaju: secure element čuva ključ i potpisuje bajtove koje mu firmver pošalje; firmver sata odlučuje šta se prikazuje i kad se potpisuje. Zato pre bilo kakve tvrdnje o hardverskoj bezbednosti idu secure boot, zaključan debug port i šifrovan kanal ka čipu. U ovom dokazu tu ulogu igra Web Worker sa istim interfejsom koji će imati drajver.",
      "Za pitanja: pre prikaza sat odbija replay, istekle zahteve, poruke veće od limita čipa, durable nonce, lookup tabele (v0) i sve što nije jedan System Program transfer sa sopstvene adrese. Odobrenje izdaje jednokratni token vezan za tačne bajtove, važi pet sekundi. Dva profila čipa u kodu: TROPIC01 (4096 bajtova, little-endian) i SE050E (919 bajtova, big-endian). Link je lokalni relay umesto Bluetootha; skidanje sa ruke odmah zatvara sesiju.",
      "Ako pomenu druge nosive potpisnike (SolWear, ESP32 sa NFC-om, je na Colosseumu): da, postoje, ne tvrdimo da smo prvi. Razlika je u ovom koraku dva: mi parsiramo poruku i prikazujemo iz bajtova koje potpisujemo; ne prikazujemo polja koja aplikacija pošalje odvojeno od bajtova. Bez omalovažavanja, samo činjenica iz koda.",
    ],
    render: () => (
      <div className="slide__body slide__body--dense">
        <h2 className="title">How it works.</h2>
        <div className="cols" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          <Step n="1" figure={<BuildDiagram />} title="Companion builds the transaction" detail="Fresh blockhash, exact message bytes, sent to the watch." />
          <Step n="2" figure={<ParseDiagram />} title="Parses the exact bytes" detail="Amount and destination read from the bytes it signs, not the app." />
          <Step n="3" figure={<ApproveDiagram />} title="PIN, then a separate approve" detail="PIN opens a session. Approve is a separate button." />
          <Step n="4" figure={<SignDiagram />} title="Ed25519 signature returns" detail="Over the same bytes. Companion verifies, assembles, broadcasts." />
        </div>
        <p className="lead foot">
          <span className="plate plate--inverse">The key never reaches the companion. On hardware it stays in the secure element.</span>
        </p>
      </div>
    ),
  },

  {
    id: "solana",
    title: "Why Solana",
    notes: [
      "Tri razloga. Ed25519 je nativan: čip potpisuje tačno one bajtove koje prikazuje, bez dodatnog heširanja i bez druge krive.",
      "Potvrda je dovoljno brza: čitav krug, zahtev, pregled na satu, pritisak, emitovanje, staje u životni vek blockhash-a; companion drži rezervu za slanje i, ako istekne, traži novi blockhash i novi pregled.",
      "Treći razlog: telefon koji korisnik već ima, Android prvo. Companion je wallet aplikacija na telefonu ili laptopu i priča sa satom preko Bluetooth LE; na Androidu dApp-ovi do nje stižu kroz Mobile Wallet Adapter, a sat je potpisnik iza nje. Seeker je kanal distribucije, ne zavisnost.",
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
              <p className="body">The watch signs the exact bytes it shows. No hashing step, no second curve.</p>
            </div>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Fast confirmation</h3>
              <p className="body">A wrist approval fits inside a blockhash&rsquo;s lifetime, with room left to broadcast.</p>
            </div>
            <div className="col">
              <hr className="rule" />
              <h3 className="sub">Android first</h3>
              <p className="body">The companion is the wallet app; the watch is the signer. iOS is a later native app.</p>
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
      "Bez brojeva. Prodajemo sat; companion je besplatan. Ovo je slajd o poslu, ne o planu: ko kupuje prvi i kako nas nalazi.",
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
            The companion is free.
          </h2>
          <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div className="card">
              <h3 className="sub">Who buys first</h3>
              <p className="mono">Solana users who keep real funds in self-custody and sign every day.</p>
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
    id: "next",
    title: "Next 90 days and the ask",
    notes: [
      "Levo je obećanje, desno molba. Jedan radni prototip za 90 dana: TROPIC01 drži ključ, nRF52840 vodi ekran, dugmad i Bluetooth, upari se sa Android telefonom, oporavak ide kroz Squads trezor. Ništa od toga još ne postoji; danas potpisuje simulator. Slika dole je render ciljanog dizajna, ne fotografija; LCD na njemu je pravi ekran simulatora, stranica APPROVE?.",
      "Kako to proveravamo: taj jedan prototip ide u ruke ljudima koji svaki dan potpisuju na Solani i sami čuvaju ključeve; gledamo da li ga nose i da li potpisuju sa njega. Ne reci deset, ne reci serija, ne reci tiraž.",
      "Tražimo tri stvari: mesto u akceleratoru, hardverskog partnera za kućište, i uvod kod Solana Mobile. Izgovori sve tri, pa stani.",
    ],
    render: () => (
      <>
        <div className="slide__bg">
          <div className="paper" style={{ position: "absolute", left: PAPER_X, top: 0, right: 0, bottom: 0 }} />
          <img
            className="target-render"
            src="/assets/watch-target-render.png"
            alt="Render of the target SEKUND design: a matte black resin watch showing the APPROVE? page"
            style={{ position: "absolute", left: RENDER.left, top: RENDER.top, width: RENDER.size, height: RENDER.size }}
          />
          <p className="caption" style={{ position: "absolute", left: 112, bottom: 112 }}>
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
              <li>nRF52840 runs the screen, buttons and Bluetooth</li>
              <li>Pairs with an Android phone</li>
              <li>Recovery through a Squads vault</li>
            </ul>
          </div>
          <div className="col on-paper" style={{ gap: 56 }}>
            <h2 className="title">The ask.</h2>
            <ul className="list">
              <li>A place in the accelerator</li>
              <li>A hardware partner for the case</li>
              <li>An introduction to Solana Mobile</li>
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
      "SEKUND je jedan potpisnik u Squads multisig trezoru, ili je uparen sa drugim satom. Izgubljen sat se zamenjuje i uklanja iz trezora; sredstva ostaju.",
      "Reci jasno: ovo je dizajn oporavka, ne nešto što je isporučeno. Squads integracija ne radi u demou; tok oporavka je stavka u planu za 90 dana. Ako pitaju za detalje, odgovor je: drugi potpisnik je ili drugi upareni sat ili ključ koji korisnik već drži, a trezor je Squads multisig na Solani.",
    ],
    render: () => (
      <div className="slide__body slide__body--dense">
        <h2 className="title">Lose the watch, not the funds.</h2>
        <p className="lead" style={{ maxWidth: 1400 }}>
          SEKUND is one signer in a Squads multisig, or paired with a second watch. A lost watch is replaced; the vault stays.
        </p>
        <p className="small dim">The recovery design. Not in the demo; in the 90-day plan.</p>
        <div className="equation">
          <div className="card card--centered">
            <DotText text="SEKUND" dot={6} />
            <p className="mono">Signer one, the watch</p>
          </div>
          <span className="op">+</span>
          <div className="card card--centered">
            <DotText text="SECOND KEY" dot={6} />
            <p className="mono">A second watch, or a key you already hold</p>
          </div>
          <span className="op">=</span>
          <div className="card card--centered on-paper">
            <DotText text="SQUADS VAULT" dot={6} />
            <p className="mono">Funds live here, not on any one device</p>
          </div>
        </div>
      </div>
    ),
  },

  {
    id: "shipped",
    title: "Shipped this week",
    notes: [
      "Ne ko smo, nego šta smo isporučili ove nedelje. Jezgro potpisivanja: parser poruke, čuvar zahteva sa allowlist-om, PIN sesija i jednokratni token za odobrenje.",
      "Potvrđena devnet transakcija potpisana u simulatoru sata. 3D simulator sa živim LCD-om. Companion koji pravi, proverava i emituje. Dva profila čipa u kodu; sami čipovi, kućište, dugme i Bluetooth su plan. Testovi za sve to, od parsera do klika na 3D dugme. Repo je na GitHubu, Apache-2.0; reci da je javan samo ako je prebačen na public pre pitcha (10. oktobra je još privatan).",
      "Imena ne idu na slajd. Ako pitaju ko šta radi: Goran vodi proizvod i inženjering. Srkijevu ulogu opiši onako kako ste se dogovorili; ne nabrajaj delove koda umesto njega. Dvoje ljudi, jedna nedelja.",
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
            The 3D simulator in the browser, live LCD.
          </p>
        </div>
        <div className="slide__body slide__body--dense">
          <h2 className="title">Shipped this week.</h2>
          <ul className="list" style={{ gap: 28, maxWidth: CAPTURE_TEXT_W }}>
            <li>Signing core: message parser, request guard, transfer allowlist, PIN session, one-time approve token</li>
            <li>A confirmed devnet transaction, signed in the watch simulator, verified before broadcast</li>
            <li>A 3D watch simulator with the live LCD on its face</li>
            <li>A companion that builds, verifies and broadcasts, with the watch&rsquo;s own words for every state</li>
            <li>Two secure-element profiles in code, TROPIC01 and SE050E. The chips themselves are roadmap</li>
          </ul>
        </div>
      </>
    ),
  },

  {
    id: "close",
    title: "Close",
    notes: [
      "Ponovi rečenicu, pa onu za sudije, pa molbu, pa stani. Proveri i potpiši Solanu na ruci; običan sat od smole; ključ nikad ne stiže do companion aplikacije.",
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
              Verify and sign
              <br />
              Solana on-wrist.
            </Knock>
            <p className="lead">
              <span className="plate plate--inverse">
                A simple resin watch.
                <br />
                The key never reaches the companion.
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
