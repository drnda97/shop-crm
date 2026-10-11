import { describe, expect, it } from "vitest";
import { fetchImage, isPrivateAddress } from "@/lib/remote-image";

describe("preuzimanje slika pri uvozu", () => {
  it("adrese unutrašnje mreže nisu javne", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.26", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
    for (const address of ["8.8.8.8", "172.32.0.1", "151.101.1.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("ne šalje zahtev ka lokalnom računaru ni ka adresama koje nisu http", async () => {
    expect(await fetchImage("http://127.0.0.1:3000/media/x.jpg")).toBeNull();
    expect(await fetchImage("http://localhost:3000/admin")).toBeNull();
    expect(await fetchImage("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(await fetchImage("file:///etc/passwd")).toBeNull();
    expect(await fetchImage("nije adresa")).toBeNull();
  });
});
