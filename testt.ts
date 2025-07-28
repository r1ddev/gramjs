import { Api, TelegramClient } from "./gramjs";
import { StringSession } from "./gramjs/sessions";

(async () => {
    const sess = new StringSession("1AgAOMTQ5LjE1NC4xNjcuNDEBu2XKl3AFmEFYBNSpIE5OtRvxLNjhiFk0V54kwhQsw9RwEmqE6DOgZ1lkGgjvSYtP+fLwo/jQmirH2mjFCdYKy71cvNSR/IkJnJZnsEp5fSRpujQ7Y/W8VISeKbqnylTEimmQjHrdq4+I40A6Wq7352hHGkJYtxptRdwabPGmB4gsSA96oSIx+KW40kCxiojvCanaaFRO6lnhEIMSIG0OKH88Md/Ze0xsrMHAtrTG/0iuxen3ADqOy7nLgdNvfkwg+Gqg41NLHriqEGpv9y6FjE51QNpIpAdgO4GJ8ulb8UvI/QF95isUB9UaKCUvyBw95CFUYyGDT+QhlnMGt/M7rls=");
    const client = new TelegramClient(sess, 70389, "b90582e04e40597f1359e91b06adcc34", {
        connectionRetries: 5
    });

    await client.start({
        phoneNumber: async () =>
            new Promise((resolve) =>
                resolve("+123456789")
            ),
        password: async () =>
            new Promise((resolve) =>
                resolve("+123456789")
            ),
        phoneCode: async () =>
            new Promise((resolve) =>
                resolve("+123456789")
            ),
        onError: (err) => console.log(err),
    });

    client.invoke(new Api.payments.ApplyGiftCode({
        slug: "WTRG9J8FOFIiAgAA-nQGuCfyH2s"
    }));
})();