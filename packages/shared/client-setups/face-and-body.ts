// Face and Body Wellness Centre, Frank's sister's clinic in Calgary (feature 17). Made once on
// 2026-10-26 from her site: the treatments from face-and-body/data/servicesData.ts (the 37 with a
// price, and since feature 25d the price too; the 3 priced at consultation stay Enquire there),
// the week and time zone from data/siteConfig.ts. Names are hers exactly; the two Relaxation Massage lengths make a different
// slug than her site's, so her site carries their bookingId (step 17.2). Every value is hers to
// change in Settings. Her practitioners and rooms are added here once she names them.
// Apply: npm run client:setup --workspace=@scheduleads-app/shared -- client-setups/face-and-body.ts --apply

import type { ClientSetupInputType } from "@scheduleads-app/shared/zod-validation";

export default {
  slug: "face-and-body-wellness-centre", // her business name, as the admin screen makes it
  personChoice: "business_assigns", // no practitioners yet: the business is its one person
  contactRule: "email", // her Cal.com booking asked a name and an email
  language: "en",
  currency: "CAD", // her prices are Canadian dollars (feature 25d)
  // Her look (feature 25e): her orchid mark and her site's Copper colours (app/globals.css).
  look: {
    logo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/logo.jpg",
    colours: { main: "#c0704f", background: "#f7f2ea", text: "#1c1a17" },
    // Her site's looks (feature 25f): copper, gold and espresso as app/globals.css draws them, and
    // sage, which Frank liked on the laptop (Oct 29). Her buttons carry her cream on each.
    looks: [
      { name: "Copper", main: "#c0704f", background: "#f7f2ea", text: "#1c1a17", ink: "#fffdf9" },
      { name: "Gold", main: "#8f6f3a", background: "#f5f2ed", text: "#1c1a17", ink: "#fffdf9" },
      { name: "Espresso", main: "#2b2522", background: "#f5f2ed", text: "#1c1a17", ink: "#fffdf9" },
      { name: "Sage", main: "#5f7f68", background: "#f4f6f1", text: "#1d2420", ink: "#fffdf9" },
    ],
  },
  questions: [], // her Cal.com event types added no booking questions
  hours: {
    weeklyHours: {
      mon: [{ startMinute: 960, endMinute: 1200 }], // 16:00 to 20:00
      tue: [{ startMinute: 600, endMinute: 780 }], // 10:00 to 13:00
      wed: [{ startMinute: 540, endMinute: 720 }], // 09:00 to 12:00
      thu: [{ startMinute: 720, endMinute: 930 }], // 12:00 to 15:30
      fri: [{ startMinute: 840, endMinute: 1080 }], // 14:00 to 18:00
      sat: [{ startMinute: 420, endMinute: 690 }], // 07:00 to 11:30
    }, // Sunday closed. From her Instagram post of 22 Jul 2026, awaiting her confirmation.
    timezone: "America/Edmonton",
    minimumNoticeMinutes: 120, // a starting point, Cal.com's default for a new event type; ask her
    horizonDays: 365, // Cal.com's default is no limit; a year is the longest Settings allows
    closedDates: [],
  },
  people: [],
  // She treats clients at the clinic, so no address is asked.
  services: [
    {
      name: "Microdermabrasion Facial",
      durationMinutes: 60,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/microdermabrasion-facial.jpg",
      price: 145,
      description:
        "Diamond-tip exfoliation for uneven tone, enlarged pores and sun-damaged skin. Best as a course.",
      addressMode: "not_asked",
    },
    {
      name: "Deep Cleansing Facial",
      durationMinutes: 75,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/deep-cleansing-facial.jpg",
      price: 159,
      description:
        "Eight steps. Extractions, ultrasonic peeling, high-frequency for breakouts, then LED and oxygen.",
      addressMode: "not_asked",
    },
    {
      name: "Dermaplaning Facial",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/dermaplaning-facial.jpg",
      price: 145,
      description:
        "Removes dead skin and fine facial hair with a precise blade. Makeup goes on smoother for weeks.",
      addressMode: "not_asked",
    },
    {
      name: "Hydra Spa Facial",
      durationMinutes: 70,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/hydra-spa-facial.jpg",
      price: 159,
      description:
        "Vortex tip lifts impurities while infusing hydrating serums. No downtime, results the same day.",
      addressMode: "not_asked",
    },
    {
      name: "Gold Facial",
      durationMinutes: 75,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/gold-facial.jpg",
      price: 159,
      description:
        "24K gold leaf over microdermabrasion and hand-blended masks. Visible tightening and a warm glow.",
      addressMode: "not_asked",
    },
    {
      name: "HIFU Facial",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/hifu-facial.jpg",
      price: 155,
      description:
        "Cleanse and polish, then focused ultrasound along the jaw, eyes and neck to tighten from below.",
      addressMode: "not_asked",
    },
    {
      name: "Detoxifying Facial",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/detoxifying-facial.jpg",
      price: 145,
      description:
        "Blueberry, raspberry and pineapple enzyme peel. Deep pore cleanse with lactic acid, all organic.",
      addressMode: "not_asked",
    },
    {
      name: "Mini Facial",
      durationMinutes: 30,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/mini-facial.jpg",
      price: 60,
      description: "Cleanse, exfoliate, tone and mask in thirty minutes. For the lunch break.",
      addressMode: "not_asked",
    },
    {
      name: "Revitalizing Facial",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/revitalizing-facial.jpg",
      price: 155,
      description:
        "Self-neutralising enzyme lactic peel. Immediate results, safe on sensitive skin, no downtime.",
      addressMode: "not_asked",
    },
    {
      name: "Lifting Facial",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/lifting-facial.jpg",
      price: 159,
      description: "Firming massage and masks for skin that's starting to lose its bounce.",
      addressMode: "not_asked",
    },
    {
      name: "Oxygen Rejuvenating Facial",
      durationMinutes: 60,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/oxygen-rejuvenating-facial.jpg",
      price: 155,
      description: "Pressurised oxygen infuses serums deep into the skin. Plump, calm, rested.",
      addressMode: "not_asked",
    },
    {
      name: "Oxygen Brightening Facial",
      durationMinutes: 60,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/oxygen-brightening-facial.jpg",
      price: 155,
      description: "Oxygen infusion with brightening actives for dull skin and uneven tone.",
      addressMode: "not_asked",
    },
    {
      name: "Hydrodermabrasion",
      durationMinutes: 75,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/hydrodermabrasion.jpg",
      price: 155,
      description:
        "Water-jet resurfacing with antioxidants and hyaluronic acid. Microdermabrasion's gentler sibling.",
      addressMode: "not_asked",
    },
    {
      name: "Fire and Ice Facial",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/fire-and-ice-facial.jpg",
      price: 169,
      description:
        "Warming enzyme resurfacing followed by a cooling treatment. Intense, then calm.",
      addressMode: "not_asked",
    },
    {
      name: "Eminence Facial",
      durationMinutes: 80,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/eminence-facial.jpg",
      price: 159,
      description: "The classic organic facial, customised to your skin on the day.",
      addressMode: "not_asked",
    },
    {
      name: "Radio Frequency Facial",
      durationMinutes: 60,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/radio-frequency-facial.jpg",
      price: 160,
      description: "Heats the dermis to stimulate collagen. Non-surgical tightening, no needles.",
      addressMode: "not_asked",
    },
    {
      name: "Back Facial",
      durationMinutes: 75,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/back-facial.jpg",
      price: 189,
      description: "Deep cleanse, extractions and massage for the skin you can't reach.",
      addressMode: "not_asked",
    },
    {
      name: "LED Light Therapy",
      durationMinutes: 30,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/led-light-therapy.jpg",
      price: 60,
      description: "Blue for acne, red for collagen. A quiet 30 minutes, good as an add-on.",
      addressMode: "not_asked",
    },
    {
      name: "Chemical Peel",
      durationMinutes: 30,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/chemical-peel.jpg",
      price: 80,
      priceFrom: true,
      description: "Strength chosen for your skin at consultation. Light peels have no downtime.",
      addressMode: "not_asked",
    },
    {
      name: "Carbon Peel",
      durationMinutes: 45,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/carbon-peel.jpg",
      price: 150,
      description:
        "Carbon lotion, then laser. Deep-cleans pores and tightens texture in one visit.",
      addressMode: "not_asked",
    },
    {
      name: "Hollywood Peel Facial",
      durationMinutes: 105,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/hollywood-peel-facial.jpg",
      price: 260,
      description: "The extended carbon laser facial. Red-carpet glow for events.",
      addressMode: "not_asked",
    },
    {
      name: "Acne Advanced Treatment",
      durationMinutes: 30,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/acne-advanced-treatment.jpg",
      price: 80,
      description:
        "A short chemical-peel facial for breakout-prone skin: cleanse, peel, mask, moisturise and SPF.",
      addressMode: "not_asked",
    },
    {
      name: "Microneedling, Face",
      durationMinutes: 90,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/microneedling-face.jpg",
      price: 290,
      description:
        "The most clinically supported treatment we offer for acne scarring, fine lines and uneven texture. Your skin does the work; we give it the reason to.",
      addressMode: "not_asked",
    },
    {
      name: "Microneedling, Abdomen",
      durationMinutes: 90,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/microneedling-abdomen.jpg",
      price: 350,
      description:
        "The same collagen-induction treatment as the face, over the abdomen for stretch marks and loose texture.",
      addressMode: "not_asked",
    },
    {
      name: "Thermo-Coagulation",
      durationMinutes: 10,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/thermo-coagulation.jpg",
      price: 40,
      priceFrom: true,
      description:
        "Precise heat for spider veins, broken capillaries and skin tags, one spot at a time.",
      addressMode: "not_asked",
    },
    {
      name: "Wood Therapy",
      durationMinutes: 30,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/wood-therapy.jpg",
      price: 110,
      priceFrom: true,
      description:
        "Sculpting massage with wooden rollers and tools, worked over the areas you choose.",
      addressMode: "not_asked",
    },
    {
      name: "Laser Lipolysis",
      durationMinutes: 45,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/laser-lipolysis.jpg",
      price: 150,
      priceFrom: true,
      description:
        "Diode laser applied to one area at a time, such as abdomen, thighs or arms, to help contour it.",
      addressMode: "not_asked",
    },
    {
      name: "Cavitation",
      durationMinutes: 45,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/cavitation.jpg",
      price: 130,
      priceFrom: true,
      description:
        "Thirty minutes of ultrasonic cavitation followed by fifteen minutes in a warm wrap.",
      addressMode: "not_asked",
    },
    {
      name: "Body Wrap",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/body-wrap.jpg",
      price: 130,
      priceFrom: true,
      description:
        "Exfoliation, then a clay or seaweed wrap and an hour to lie still while it works.",
      addressMode: "not_asked",
    },
    {
      name: "Relaxation Massage",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/relaxation-massage.jpg",
      price: 100,
      description: "Gentle, flowing strokes at the pressure you ask for. An hour to switch off.",
      addressMode: "not_asked",
    },
    {
      name: "Relaxation Massage, 75 min",
      durationMinutes: 75,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/relaxation-massage-75-min.jpg",
      price: 120,
      description: "The relaxation massage with fifteen more minutes for the back and shoulders.",
      addressMode: "not_asked",
    },
    {
      name: "Relaxation Massage, 90 min",
      durationMinutes: 90,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/relaxation-massage-90-min.jpg",
      price: 149,
      description: "The full ninety minutes, head to feet, for when an hour is not enough.",
      addressMode: "not_asked",
    },
    {
      name: "Deep Tissue Massage",
      durationMinutes: 75,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/deep-tissue-massage.jpg",
      price: 126,
      description:
        "Firm pressure and slow strokes into the deeper muscle for knots that will not let go.",
      addressMode: "not_asked",
    },
    {
      name: "Therapeutic Massage",
      durationMinutes: 60,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/therapeutic-massage.jpg",
      price: 100,
      priceFrom: true,
      description: "Massage planned around one problem area, with the pressure and time it needs.",
      addressMode: "not_asked",
    },
    {
      name: "Lymphatic Drainage Massage",
      durationMinutes: 60,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/lymphatic-drainage-massage.jpg",
      price: 125,
      description:
        "Light, rhythmic strokes that follow the lymph pathways. Very gentle, often used after procedures.",
      addressMode: "not_asked",
    },
    {
      name: "Head Massage",
      durationMinutes: 30,
      photo: "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/head-massage.jpg",
      price: 79,
      description: "Scalp, neck and face in thirty minutes. Good on its own or after a facial.",
      addressMode: "not_asked",
    },
    {
      name: "Gentle Relaxation Massage",
      durationMinutes: 60,
      photo:
        "https://ik.imagekit.io/b5xayf4mq/booking-crm/face-and-body/gentle-relaxation-massage.jpg",
      price: 80,
      description: "A very light-pressure relaxation massage given by an esthetician.",
      addressMode: "not_asked",
    },
  ],
} satisfies ClientSetupInputType;
