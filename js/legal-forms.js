(function () {
  "use strict";
  document
    .querySelectorAll("[data-print]")
    .forEach((button) =>
      button.addEventListener("click", () => window.print()),
    );
  document.querySelectorAll("[data-service-form]").forEach((form) => {
    const button = form.querySelector("[type=submit]"),
      status = form.querySelector("[data-status]");
    let pending = false,
      complete = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pending || complete || !form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form)),
        kind = form.dataset.serviceForm;
      const payload =
        kind === "contact"
          ? { ...values, source: "contact" }
          : { ...values, kind };
      const api = window.NFW_SITE?.apiBase;
      if (typeof api !== "string") {
        status.textContent =
          "Online odeslání není dostupné. Zavolej na +420 723 958 421 nebo použij písemné podání na adresu sídla. Údaje zůstaly vyplněné.";
        return;
      }
      pending = true;
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      status.textContent = "Odesíláme…";
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(
          api.replace(/\/$/, "") +
            (kind === "contact" ? "/api/enquiries" : "/api/requests"),
          {
            method: "POST",
            credentials: "omit",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              "X-NFW-Request": "1",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        );
        const data = await response.json();
        if (!response.ok || data.status !== "received" || !data.reference)
          throw new Error(
            data?.error?.message || "Přijetí se nepodařilo potvrdit.",
          );
        complete = true;
        status.dataset.state = "success";
        status.textContent =
          "Podání jsme přijali. Referenční číslo: " +
          data.reference +
          ". Ulož si kopii níže. E-mailové potvrzení nyní není odesíláno.";
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "print";
        copy.textContent = "Stáhnout kopii podání";
        const lines = [
          "Need For Wheels by Oarts s.r.o. | IČO 30074088",
          "Potvrzení přijetí podání",
          "Reference: " + data.reference,
          "Datum: " + new Date().toLocaleString("cs-CZ"),
          "Druh: " +
            (kind === "withdrawal"
              ? "Odstoupení"
              : kind === "complaint"
                ? "Reklamace"
                : "Dotaz / poptávka"),
          "Jméno: " + values.name,
          "E-mail: " + values.email,
          "Telefon: " + (values.phone || ""),
          "Objednávka / vůz: " +
            (values.orderReference || values.vehicle || ""),
          "",
          values.message,
          "",
          "Toto potvrzuje doručení podání, nikoli výsledek jeho posouzení.",
        ];
        copy.addEventListener("click", () => {
          const link = document.createElement("a"),
            url = URL.createObjectURL(
              new Blob(["\ufeff" + lines.join("\r\n")], {
                type: "text/plain;charset=utf-8",
              }),
            );
          link.href = url;
          link.download =
            "oarts-podani-" +
            String(data.reference).replace(/[^a-z0-9-]/gi, "") +
            ".txt";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        status.after(copy);
      } catch (error) {
        status.dataset.state = "error";
        status.textContent =
          "Přijetí není potvrzené. " +
          (error.name === "AbortError" || error instanceof TypeError
            ? "Spojení se serverem se nepodařilo dokončit."
            : error.message) +
          " Údaje zůstaly vyplněné. Pokud si nejsi jistý přijetím, zavolej na +420 723 958 421.";
      } finally {
        clearTimeout(timer);
        pending = false;
        button.disabled = complete;
        form.removeAttribute("aria-busy");
        status.focus({ preventScroll: true });
        status.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    button.disabled = typeof window.NFW_SITE?.apiBase !== "string";
    if (button.disabled) {
      status.dataset.state = "error";
      status.textContent =
        "Online odeslání nyní není dostupné. Zavolej na +420 723 958 421 nebo napiš na adresu sídla. Údaje zůstávají ve formuláři.";
    }
  });
})();
