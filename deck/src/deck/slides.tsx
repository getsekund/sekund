import { Dither } from "@/dither/Dither";
import { bands, fade, horizon, pulse } from "@/dither/fields";
import { DotText } from "@/ui/DotText";
import { Shot, Step } from "@/ui/pieces";
import { Wordmark } from "@/ui/Wordmark";
import { EARLIER_TX, PROOF_TX, REPO_URL, explorerUrl, shortKey } from "./facts";
import type { Slide } from "./types";

const STAGE_W = 1920;
const STAGE_H = 1080;

export const SLIDES: readonly Slide[] = [
  {
    id: "claim",
    title: "Claim",
    bareMark: true,
    notes: [
      "Jedna rečenica, pa stani. Jeftin digitalni sat koji potpisuje Solana transakcije. Ključ ne napušta ručni zglob: ne ide u telefon, ne ide preko linka, ne ide u aplikaciju.",
      "Sve ostalo u prezentaciji je dokaz ove rečenice. Ne objašnjavaj još ništa; pusti sliku sata da stoji dve sekunde.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <Dither width={STAGE_W} height={STAGE_H} cell={6} field={pulse} animate={active} fps={16} contrast={1} />
          <div style={{ position: "absolute", right: 96, top: 60, width: 760, height: 960 }}>
            <Dither
              width={760}
              height={960}
              cell={4}
              src="/assets/watch-clock-dark.png"
              fit="contain"
              contrast={1.35}
              gamma={0.9}
              reveal={active ? 900 : 0}
            />
          </div>
        </div>
        <div className="slide__body" style={{ justifyContent: "space-between" }}>
          <div className="plate" style={{ width: 300, padding: "8px 24px 8px 0" }}>
            <Wordmark width={260} />
          </div>
          <div style={{ maxWidth: 1040 }}>
            <div className="block">
              <h1 className="claim">
                A cheap digital watch
                <br />
                that signs Solana
                <br />
                transactions.
              </h1>
            </div>
            <p className="lead" style={{ marginTop: 24 }}>
              <span className="plate plate--inverse">The key never leaves your wrist.</span>
            </p>
          </div>
          <p className="small plate dim" style={{ alignSelf: "flex-start" }}>
            Colosseum Crypto World&rsquo;s Fair &middot; software proof of concept on Solana devnet
          </p>
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
        <div className="slide__body" style={{ justifyContent: "center", gap: 64 }}>
          <h2 className="title" style={{ maxWidth: 1100 }}>
            Hardware wallets are
            <br />a second object.
          </h2>
          <ul className="list" style={{ maxWidth: 1060 }}>
            <li>People don&rsquo;t carry them.</li>
            <li>So they sign on the phone, beside every other app, or they don&rsquo;t sign at all.</li>
          </ul>
          <p className="lead" style={{ marginTop: 8 }}>
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
      `Ovo je devnet transakcija potvrđena 8. oktobra 2026: ${PROOF_TX.amountSol} SOL, jedini potpisnik je adresa sata ${shortKey(PROOF_TX.signer)}. Companion je proverio potpis pre slanja. Levo je sat na ekranu APPROVE?, desno sažetak iz Solana Explorera, isti potpis.`,
      "Reci glasno: u ovom dokazu secure element je softver, Web Worker sa Ed25519 ključem koji se ne može izvesti. Potpis je pravi Ed25519 i lanac ga je prihvatio. Ne reci da je čip već u kućištu.",
      `Ako traže drugi primer: ranija potvrda ${shortKey(EARLIER_TX.signature)}, ${EARLIER_TX.amountSol} SOL sa adrese ${shortKey(EARLIER_TX.signer)}, takođe potpisana na satu.`,
    ],
    render: () => (
      <div className="slide__body" style={{ gap: 36 }}>
        <h2 className="title" style={{ fontSize: 84 }}>
          Signed on the watch. <span className="dim">Confirmed on devnet.</span>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 56, alignItems: "start", flex: 1, minHeight: 0 }}>
          <Shot src="/assets/lcd-approve.png" alt="The watch LCD on the APPROVE? page with the countdown" width={400} height={487} caption="The last review page on the watch. D approves." />
          <div style={{ display: "flex", flexDirection: "column", gap: 26, minWidth: 0 }}>
            <Shot src="/assets/explorer-rows.png" alt="Solana Explorer summary of the confirmed devnet transaction: success, signature, fee payer, slot, timestamp" width={1240} height={444} caption="Solana Explorer, devnet. Status Success. Fee payer and only signer: the watch." />
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 40, rowGap: 6, alignItems: "baseline" }}>
              <span className="caption">Transfer</span>
              <span className="mono">
                <span className="lcd" style={{ fontSize: 40 }}>
                  {PROOF_TX.amountSol}
                </span>{" "}
                SOL &middot; signer {shortKey(PROOF_TX.signer)}, the watch &middot; to {shortKey(PROOF_TX.destination)}
              </span>
              <span className="caption">Explorer</span>
              <a className="small" href={explorerUrl(PROOF_TX.signature)} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", textDecorationThickness: 1, textUnderlineOffset: 6, fontSize: 22 }}>
                {explorerUrl(PROOF_TX.signature)}
              </a>
            </div>
          </div>
        </div>
        <p className="small">
          <span className="plate plate--inverse">In this proof the secure element is software. The Ed25519 signature is real.</span>
        </p>
      </div>
    ),
  },

  {
    id: "how",
    title: "How it works",
    notes: [
      "Četiri koraka, bez detalja. Companion pravi transakciju odmah posle blockhash-a i šalje tačne bajtove poruke. Sat prikazuje iznos i primaoca pročitane iz tih bajtova, ne iz teksta koji je poslala aplikacija.",
      "PIN otvara sesiju; odobrenje je poseban fizički pritisak. Čip vraća Ed25519 potpis nad neheširanim bajtovima; companion ga proveri, sastavi transakciju i emituje. Tri pogrešna PIN-a brišu ključ.",
      "Za pitanja: pre prikaza sat odbija replay, istekle zahteve, poruke veće od limita čipa, durable nonce, lookup tabele (v0) i sve što nije jedan System Program transfer sa sopstvene adrese. Odobrenje izdaje jednokratni token vezan za tačne bajtove, važi pet sekundi. Dva profila čipa u kodu: TROPIC01 (4096 bajtova, little-endian) i SE050E (919 bajtova, big-endian). Link je lokalni relay umesto Bluetootha; skidanje sa ruke odmah zatvara sesiju.",
    ],
    render: () => (
      <div className="slide__body" style={{ gap: 40 }}>
        <h2 className="title">How it works.</h2>
        <div className="cols" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 32, flex: 1 }}>
          <Step n="1" src="/assets/companion-card-mobile.png" alt="The companion request card on a phone, waiting for the watch" title="Companion builds the transaction" detail="Fresh blockhash, exact message bytes, sent to the watch." fit="contain" background="#e9eae4" />
          <Step n="2" src="/assets/lcd-to.png" alt="The watch LCD showing the destination address" title="Watch shows amount and destination" detail="Read from the bytes it will sign, not from the app." />
          <Step n="3" src="/assets/lcd-approve.png" alt="The watch LCD on the APPROVE? page" title="PIN, then a physical approve" detail="PIN opens a session. Approve is its own button press." />
          <Step n="4" src="/assets/lcd-signed.png" alt="The watch LCD showing SIGNED, sent to app" title="Ed25519 signature returns" detail="Companion verifies it, assembles the transaction, broadcasts." />
        </div>
        <p className="lead">
          <span className="plate plate--inverse">Three wrong PINs wipe the key.</span>
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
      "Mobile Wallet Adapter i Seeker: ekosistem telefona koji već očekuje spoljnog potpisnika. Ako pitaju za Ethereum: druga kriva (secp256k1), to je roadmap, ne ovaj build.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <div style={{ position: "absolute", left: 0, bottom: 0, width: STAGE_W, height: 300 }}>
            <Dither width={STAGE_W} height={300} cell={6} field={horizon} animate={active} fps={12} />
          </div>
        </div>
        <div className="slide__body" style={{ gap: 72, paddingBottom: 300, justifyContent: "center" }}>
          <h2 className="title">
            <span className="plate">Why Solana.</span>
          </h2>
          <div className="cols" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 56 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <hr className="rule" />
              <h3 className="lead" style={{ fontWeight: 600 }}>
                <span className="plate">Native Ed25519</span>
              </h3>
              <p className="body">
                <span className="plate">The chip signs the exact bytes it shows. No hashing step, no second curve.</span>
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <hr className="rule" />
              <h3 className="lead" style={{ fontWeight: 600 }}>
                <span className="plate">Fast confirmation</span>
              </h3>
              <p className="body">
                <span className="plate">A wrist approval fits inside a blockhash&rsquo;s lifetime, with room left to broadcast.</span>
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <hr className="rule" />
              <h3 className="lead" style={{ fontWeight: 600 }}>
                <span className="plate">Mobile Wallet Adapter &middot; Seeker</span>
              </h3>
              <p className="body">
                <span className="plate">A phone ecosystem that already expects an external signer.</span>
              </p>
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
      "Dva pravca koja proveravamo, ne prognoze: white-label za berze i custody deskove, kojima treba jeftin fizički potpisnik za klijente; Seeker bundle, sat uz telefon.",
      "Ako pitaju za cenu ili tiraž: to još nemamo i nećemo izmišljati.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <div style={{ position: "absolute", left: 1320, top: 0, width: 600, height: STAGE_H }}>
            <Dither width={600} height={STAGE_H} cell={6} field={bands} animate={active} fps={10} />
          </div>
        </div>
        <div className="slide__body" style={{ gap: 64, justifyContent: "center", paddingRight: 640 }}>
          <h2 className="title">
            We sell the watch.
            <br />
            The companion is free.
          </h2>
          <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div className="step" style={{ minHeight: 0, gap: 14 }}>
              <h3 className="step__t">White-label</h3>
              <p className="step__d" style={{ color: "var(--d-ink)" }}>
                Exchanges and custody desks hand clients a signer they will actually wear.
              </p>
            </div>
            <div className="step" style={{ minHeight: 0, gap: 14 }}>
              <h3 className="step__t">Seeker bundle</h3>
              <p className="step__d" style={{ color: "var(--d-ink)" }}>
                The watch beside the phone, paired out of the box through Mobile Wallet Adapter.
              </p>
            </div>
          </div>
          <p className="small dim">Directions we are testing, not forecasts.</p>
        </div>
      </>
    ),
  },

  {
    id: "next",
    title: "Next 90 days and the ask",
    notes: [
      "Levo je plan, desno molba. Naručujemo Tropic Square TROPIC01 Mini Board i Nordic nRF52840 DK, dižemo SPI i secure channel ka čipu, pa BLE uparivanje umesto lokalnog linka.",
      "Cilj do kraja perioda: deset radnih prototipova i tok oporavka koji se može demonstrirati.",
      "Tražimo tri stvari: mesto u akceleratoru, uvod kod Solana Mobile, i hardverskog partnera za kućište i malu seriju. Izgovori sve tri, pa stani.",
    ],
    render: () => (
      <div className="slide__body" style={{ gap: 56 }}>
        <div className="cols" style={{ gridTemplateColumns: "1fr 1fr", gap: 72, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
            <h2 className="title">Next 90 days.</h2>
            <ul className="list">
              <li>Tropic Square TROPIC01 and Nordic nRF52840 boards on the bench</li>
              <li>Ten working prototypes</li>
              <li>Bluetooth LE pairing in place of the local link</li>
              <li>Recovery flow</li>
            </ul>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 44, background: "var(--d-ink)", color: "var(--d-ground)", padding: "48px 56px", alignSelf: "stretch" }}>
            <h2 className="title">The ask.</h2>
            <ul className="list" style={{ ["--d-ink" as string]: "#000" }}>
              <li>A place in the accelerator cohort</li>
              <li>An introduction to Solana Mobile</li>
              <li>A hardware partner for the case and the first run</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  {
    id: "recovery",
    title: "Recovery",
    notes: [
      "Ključ koji ne napušta sat postavlja pitanje: šta kad sat nestane? Odgovor nije seed fraza na papiru.",
      "SEKUND je jedan potpisnik u Squads multisig trezoru, ili je uparen sa drugim satom. Izgubljen sat se zamenjuje i uklanja iz trezora; sredstva ostaju.",
      "!ODLUKA ZA GORANA: okvir Squads multisig / drugi upareni sat još nije potvrđen kao zvanični odgovor. Ako ne stoji, slajd se skraćuje na „tok oporavka je u planu za 90 dana“ i dijagram se uklanja.",
    ],
    render: () => (
      <div className="slide__body" style={{ gap: 56 }}>
        <h2 className="title">Lose the watch, not the funds.</h2>
        <p className="lead" style={{ maxWidth: 1400 }}>
          SEKUND is one signer in a Squads multisig, or paired with a second watch. A lost watch is replaced; the vault stays.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr 120px 1fr", alignItems: "center", gap: 24, flex: 1 }}>
          <div className="step" style={{ minHeight: 260, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 20 }}>
            <DotText text="SEKUND" dot={6} />
            <p className="step__d">Signer one, on the wrist</p>
          </div>
          <span className="title" style={{ fontSize: 80, textAlign: "center", fontWeight: 400 }}>
            +
          </span>
          <div className="step" style={{ minHeight: 260, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 20 }}>
            <DotText text="SECOND KEY" dot={6} />
            <p className="step__d">A second watch, or a key you already hold</p>
          </div>
          <span className="title" style={{ fontSize: 80, textAlign: "center", fontWeight: 400 }}>
            =
          </span>
          <div className="step" style={{ minHeight: 260, justifyContent: "center", alignItems: "center", textAlign: "center", gap: 20, background: "var(--d-ink)", color: "var(--d-ground)" }}>
            <DotText text="SQUADS VAULT" dot={6} />
            <p className="step__d" style={{ color: "var(--d-ground)" }}>Funds live here, not on any one device</p>
          </div>
        </div>
      </div>
    ),
  },

  {
    id: "shipped",
    title: "Shipped this week",
    notes: [
      "Ne ko smo, nego šta smo isporučili ove nedelje. Jezgro potpisivanja: protokol, čuvar zahteva sa allowlist-om, PIN sesija i jednokratni token za odobrenje.",
      "Potvrđena devnet transakcija potpisana na satu. 3D simulator sata sa živim LCD-om i 2D rezervom. Companion koji pravi, proverava i emituje. Testovi za sve to, od parsera do klika na 3D dugme.",
      "Ako pitaju ko šta radi: Goran sat, 3D model, lice i pitch; Srki protokol, secure element i companion. Dvoje ljudi, jedna nedelja.",
    ],
    render: ({ active }) => (
      <div className="slide__body" style={{ gap: 48 }}>
        <h2 className="title">Shipped this week.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 640px", gap: 72, flex: 1, alignItems: "start" }}>
          <ul className="list" style={{ gap: 30 }}>
            <li>Signing core: request guard, transfer allowlist, PIN session, one-time approve token</li>
            <li>A confirmed devnet transaction, signed on the watch, verified before broadcast</li>
            <li>A 3D watch simulator with the live LCD on its face, and a flat fallback</li>
            <li>A companion that builds, verifies and broadcasts, with the watch&rsquo;s own words for every state</li>
            <li>Two secure-element profiles in code: TROPIC01 and SE050E</li>
          </ul>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {["lcd-pin", "lcd-to", "lcd-approve", "lcd-signed"].map((name, i) => (
              <div className="frame__img" style={{ width: 312, height: 312 }} key={name}>
                <Dither width={308} height={308} cell={3} src={`/assets/${name}.png`} fit="cover" contrast={1.3} gamma={0.95} reveal={active ? 700 + i * 200 : 0} />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  {
    id: "close",
    title: "Close",
    bareMark: true,
    notes: [
      "Ponovi rečenicu i molbu, pa stani. Jeftin digitalni sat koji potpisuje Solana transakcije; ključ ne napušta ručni zglob.",
      "Tražimo akcelerator, uvod kod Solana Mobile i hardverskog partnera. Repo je na GitHubu. Hvala.",
    ],
    render: ({ active }) => (
      <>
        <div className="slide__bg">
          <Dither width={STAGE_W} height={STAGE_H} cell={6} field={pulse} animate={active} fps={16} />
          <div style={{ position: "absolute", left: 1060, top: 40, width: 820, height: 1000 }}>
            <Dither width={820} height={1000} cell={4} src="/assets/watch-approve-dark.png" fit="contain" contrast={1.35} gamma={0.9} reveal={active ? 900 : 0} />
          </div>
        </div>
        <div className="slide__body" style={{ justifyContent: "space-between" }}>
          <div className="plate" style={{ width: 300, padding: "8px 24px 8px 0" }}>
            <Wordmark width={260} />
          </div>
          <div style={{ maxWidth: 1000, display: "flex", flexDirection: "column", gap: 28, alignItems: "flex-start" }}>
            <div className="block">
              <h2 className="claim" style={{ fontSize: 96 }}>
                A cheap digital watch
                <br />
                that signs Solana
                <br />
                transactions.
              </h2>
            </div>
            <p className="lead">
              <span className="plate plate--inverse">The key never leaves your wrist.</span>
            </p>
            <div className="block" style={{ padding: "8px 32px 12px 0" }}>
              <p className="body">Fund SEKUND: accelerator, Solana Mobile, a hardware partner.</p>
            </div>
          </div>
          <p className="small plate" style={{ alignSelf: "flex-start" }}>
            <a href={REPO_URL} target="_blank" rel="noreferrer" style={{ textDecorationThickness: 1, textUnderlineOffset: 6 }}>
              github.com/GoranUI/Sekund
            </a>
          </p>
        </div>
      </>
    ),
  },
];

export const SLIDE_IDS: readonly string[] = SLIDES.map((slide) => slide.id);
