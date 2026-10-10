import { ILLUSTRATION } from "@/brand/illustrations";
import { Dither } from "@/dither/Dither";
import { bands, fade, horizon, pulse } from "@/dither/fields";
import { DotText } from "@/ui/DotText";
import { HeroWatch } from "@/ui/HeroWatch";
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
          <Step n="1" src="/assets/companion-card-mobile.png" alt="The companion request card on a phone, waiting for the watch" title="Companion builds the transaction" detail="Fresh blockhash, exact message bytes, sent to the watch." fit="contain" background="#e9eae4" />
          <Step n="2" src="/assets/lcd-to.png" alt="The watch LCD showing the destination address" title="Parses the exact bytes" detail="Amount and destination read from the bytes it signs, not the app." />
          <Step n="3" src="/assets/lcd-approve.png" alt="The watch LCD on the APPROVE? page" title="PIN, then a separate approve" detail="PIN opens a session. Approve is a separate button." />
          <Step n="4" src="/assets/lcd-signed.png" alt="The watch LCD showing SIGNED, sent to app" title="Ed25519 signature returns" detail="Over the same bytes. Companion verifies, assembles, broadcasts." />
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
      "Bez brojeva. Prodajemo sat; companion je besplatan.",
      "Redosled, ne prognoza: prvo hardverski prototip; onda pilot, taj jedan prototip u rukama nekog ko već sam čuva ključeve na Solani; onda Wallet Standard adapter i postojeći wallet-i koji nas prikažu kao podržanog potpisnika; onda pre-orderi sa povratnim depozitom. Solana Mobile je sledeći kanal: companion na Seeker dApp Store-u, bundle ako ga zaslužimo. Seeker je kanal, ne zavisnost: companion je Android prvo, na bilo kom Android telefonu sa Chrome-om; iOS je kasnija nativna aplikacija.",
      "White-label za berze i custody deskove tek posle pravog secure elementa, secure boot-a i eksterne revizije. Pre toga ga ne nudimo.",
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
              <h3 className="sub">Direct, in this order</h3>
              <p className="mono">Hardware prototype. A small Solana self-custody pilot. Wallet Standard and existing wallets. Refundable pre-orders.</p>
            </div>
            <div className="card">
              <h3 className="sub">Solana Mobile, next</h3>
              <p className="mono">The companion on the Seeker dApp Store; a bundle if it earns one. A channel, not a requirement.</p>
            </div>
          </div>
          <p className="small dim">White-label only after a real secure element, secure boot and an audit.</p>
        </div>
      </>
    ),
  },

  {
    id: "next",
    title: "Next 90 days and the ask",
    notes: [
      "Levo je plan, desno molba. Naručujemo Tropic Square TROPIC01 Mini Board i Nordic nRF52840 DK, dižemo SPI i secure channel ka čipu, pa BLE uparivanje umesto lokalnog linka. Ništa od toga još ne postoji; danas potpisuje simulator.",
      "Cilj do kraja perioda: jedan završen radni prototip, ne serija. Pilot je taj jedan prototip u rukama nekog ko već sam čuva ključeve na Solani. Uz to tok oporavka (Squads dizajn) koji se može demonstrirati. Ne reci deset, ne reci tiraž.",
      "Tražimo tri stvari: mesto u akceleratoru, uvod kod Solana Mobile kao kanal, i hardverskog partnera za kućište i taj prvi prototip. Izgovori sve tri, pa stani.",
    ],
    render: () => (
      <>
        <div className="slide__bg">
          <div className="paper" style={{ position: "absolute", left: 1000, top: 0, right: 0, bottom: 0 }} />
        </div>
        <div className="slide__body" style={{ display: "grid", gridTemplateColumns: "792px 1fr", columnGap: 192, alignContent: "start" }}>
          <div className="col" style={{ gap: 56 }}>
            <h2 className="title">Next 90 days.</h2>
            <ul className="list">
              <li>Tropic Square TROPIC01 and Nordic nRF52840 boards on the bench</li>
              <li>One final working prototype in 90 days</li>
              <li>Bluetooth LE pairing in place of the local link</li>
              <li>A small Solana self-custody pilot</li>
              <li>Recovery flow, the Squads design</li>
            </ul>
          </div>
          <div className="col on-paper" style={{ gap: 56 }}>
            <h2 className="title">The ask.</h2>
            <ul className="list">
              <li>A place in the accelerator cohort</li>
              <li>An introduction to Solana Mobile, as a channel</li>
              <li>A hardware partner for the case and the first prototype</li>
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
      <div className="slide__body slide__body--dense">
        <h2 className="title">Shipped this week.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 560px", gap: 96, alignItems: "start", flex: 1, minHeight: 0 }}>
          <ul className="list" style={{ gap: 28 }}>
            <li>Signing core: message parser, request guard, transfer allowlist, PIN session, one-time approve token</li>
            <li>A confirmed devnet transaction, signed in the watch simulator, verified before broadcast</li>
            <li>A 3D watch simulator with the live LCD on its face</li>
            <li>A companion that builds, verifies and broadcasts, with the watch&rsquo;s own words for every state</li>
            <li>Two secure-element profiles in code, TROPIC01 and SE050E. The chips themselves are roadmap</li>
          </ul>
          <figure className="frame" style={{ margin: 0, alignSelf: "stretch", minHeight: 0 }}>
            <img className="render" src="/assets/watch-sim-3d.png" alt="The 3D watch simulator, dark theme, showing the clock face" />
            <figcaption className="caption">The 3D simulator in the browser, live LCD.</figcaption>
          </figure>
        </div>
      </div>
    ),
  },

  {
    id: "close",
    title: "Close",
    notes: [
      "Ponovi rečenicu, pa onu za sudije, pa molbu, pa stani. Proveri i potpiši Solanu na ruci; običan sat od smole; ključ nikad ne stiže do companion aplikacije.",
      "Za sudije: simulator prikazuje tačno ono što potpisuje, potpisuje samo posle radnje odobrenja na satu, i devnet je to prihvatio. Sve tri su proverljive, u Exploreru i u repou.",
      "Tražimo akcelerator, uvod kod Solana Mobile i hardverskog partnera. Repo je na GitHubu, Apache-2.0. Hvala.",
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
              Fund SEKUND: accelerator, Solana Mobile, a hardware partner.
            </Knock>
          </div>
          <p className="small foot">
            <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">
              <Knock>github.com/GoranUI/Sekund</Knock>
            </a>
          </p>
        </div>
      </>
    ),
  },
];

export const SLIDE_IDS: readonly string[] = SLIDES.map((slide) => slide.id);
