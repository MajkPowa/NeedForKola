/* Public operating details. Never place credentials or customer data here. */
window.NFW_SITE = Object.freeze({
  apiBase:
    location.hostname === "oarts.cz" ||
    location.hostname === "www.oarts.cz" ||
    location.hostname.endsWith(".workers.dev")
      ? ""
      : "https://nfw-commerce.largoverse-private.workers.dev",
  email: "info@oarts.cz",
  phone: "+420 723 958 421",
  siteUrl: "https://oarts.cz/",
  adminUrl: "https://oarts.cz/admin",
  company: Object.freeze({
    name: "Need For Wheels by Oarts s.r.o.",
    ico: "30074088",
    seat: "Příčná 1892/4, Nové Město, 110 00 Praha 1",
    register: "C 456867 vedená u Městského soudu v Praze",
    warehouse: "Předvrší 846, 725 26 Ostrava – Krásné Pole",
  }),
  socials: Object.freeze({
    instagram: "https://www.instagram.com/nfw.oarts/",
    tiktok: "https://www.tiktok.com/@nfw.oarts",
  }),
});
