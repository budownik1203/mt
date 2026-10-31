import { test } from "node:test";
import assert from "node:assert/strict";
import { DIR, WEAPONS, ARMOURS, mirror, blockMatches, effectiveDir, attackOf, damage, hitPart, dirFromMouse, shieldCovers, speedBonus } from "../src/game/combat.ts";

test("blocks mirror side swings, keep overhead and thrust", () => {
  assert.equal(mirror(DIR.LEFT), DIR.RIGHT);
  assert.equal(mirror(DIR.RIGHT), DIR.LEFT);
  assert.ok(blockMatches(DIR.OVER, DIR.OVER));
  assert.ok(blockMatches(DIR.THRUST, DIR.THRUST));
  assert.ok(blockMatches(DIR.RIGHT, DIR.LEFT));
  assert.ok(!blockMatches(DIR.RIGHT, DIR.RIGHT));
});

test("axes cannot thrust, spear thrusts and swings with the shaft", () => {
  assert.equal(effectiveDir(WEAPONS.greataxe, DIR.THRUST), DIR.OVER);
  assert.equal(attackOf(WEAPONS.spear, DIR.THRUST).type, "pierce");
  assert.equal(attackOf(WEAPONS.spear, DIR.LEFT).type, "blunt");
});

test("cut is stopped by plate far more than blunt", () => {
  const cutVsRags = damage(40, "cut", ARMOURS.rags.body, "body");
  const cutVsPlate = damage(40, "cut", ARMOURS.plate.body, "body");
  const bluntVsPlate = damage(40, "blunt", ARMOURS.plate.body, "body");
  assert.ok(cutVsRags > 30);
  assert.ok(cutVsPlate < 20, `cut vs plate ${cutVsPlate}`);
  assert.ok(bluntVsPlate > cutVsPlate * 1.5, `blunt ${bluntVsPlate} cut ${cutVsPlate}`);
});

test("pierce sits between cut and blunt against mail", () => {
  const a = ARMOURS.mail.body;
  const c = damage(30, "cut", a, "body"), p = damage(30, "pierce", a, "body"), b = damage(30, "blunt", a, "body");
  assert.ok(c < p && p < b, `${c} ${p} ${b}`);
});

test("head hits hurt more, running in helps, backing off hurts", () => {
  assert.ok(damage(30, "cut", 10, "head") > damage(30, "cut", 10, "body"));
  assert.ok(damage(30, "cut", 10, "body", 5) > damage(30, "cut", 10, "body", 0));
  assert.ok(damage(30, "cut", 10, "body", -5) < damage(30, "cut", 10, "body", 0));
  assert.equal(speedBonus(100), 0.5);
  assert.equal(speedBonus(-100), -0.2);
});

test("damage is at least 1", () => {
  assert.equal(damage(1, "cut", 1000, "legs"), 1);
});

test("hit locations follow attack direction", () => {
  assert.equal(hitPart(DIR.OVER, 0.1), "head");
  assert.equal(hitPart(DIR.THRUST, 0.5), "body");
  assert.equal(hitPart(DIR.LEFT, 0.95), "legs");
});

test("mouse movement picks direction like M&B", () => {
  assert.equal(dirFromMouse(0, -5), DIR.OVER);
  assert.equal(dirFromMouse(0, 5), DIR.THRUST);
  assert.equal(dirFromMouse(-5, 1), DIR.LEFT);
  assert.equal(dirFromMouse(5, -1), DIR.RIGHT);
});

test("shield covers front arc only", () => {
  assert.ok(shieldCovers(1));
  assert.ok(shieldCovers(0));
  assert.ok(!shieldCovers(-0.9));
});
