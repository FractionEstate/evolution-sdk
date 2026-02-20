import { describe, expect, it } from "vitest"

import * as Data from "../src/Data.js"
import * as TSchema from "../src/TSchema.js"

describe("TSchema.TaggedUnion", () => {
  describe("Auto-detection with _tag field", () => {
    it("should auto-detect _tag field in Union members", () => {
      const Mint = TSchema.Struct(
        {
          _tag: TSchema.Literal("Mint"),
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Burn = TSchema.Struct(
        {
          _tag: TSchema.Literal("Burn"),
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Action = TSchema.Union(Mint, Burn)

      // Test encode - tag should be stripped from CBOR
      const mintValue = { _tag: "Mint" as const, amount: 100n }
      const mintEncoded = Data.withSchema(Action).toData(mintValue)

      expect(mintEncoded).toBeInstanceOf(Data.Constr)
      expect(mintEncoded.index).toBe(0n)
      expect(mintEncoded.fields).toHaveLength(1)
      expect(mintEncoded.fields[0]).toBe(100n)

      // Test decode - tag should be injected back
      const mintDecoded = Data.withSchema(Action).fromData(mintEncoded)
      expect(mintDecoded).toEqual({ _tag: "Mint", amount: 100n })

      // Test second variant
      const burnValue = { _tag: "Burn" as const, amount: 50n }
      const burnEncoded = Data.withSchema(Action).toData(burnValue)

      expect(burnEncoded.index).toBe(1n)
      expect(burnEncoded.fields).toEqual([50n])

      const burnDecoded = Data.withSchema(Action).fromData(burnEncoded)
      expect(burnDecoded).toEqual({ _tag: "Burn", amount: 50n })
    })

    it("should handle multiple fields with _tag", () => {
      const Transfer = TSchema.Struct(
        {
          _tag: TSchema.Literal("Transfer"),
          from: TSchema.ByteArray,
          to: TSchema.ByteArray,
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Stake = TSchema.Struct(
        {
          _tag: TSchema.Literal("Stake"),
          poolId: TSchema.ByteArray,
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Transaction = TSchema.Union(Transfer, Stake)

      const transferValue = {
        _tag: "Transfer" as const,
        from: new Uint8Array([1, 2, 3]),
        to: new Uint8Array([4, 5, 6]),
        amount: 1000n
      }

      const encoded = Data.withSchema(Transaction).toData(transferValue)
      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toHaveLength(3) // _tag is stripped, 3 fields remain

      const decoded = Data.withSchema(Transaction).fromData(encoded)
      expect(decoded).toEqual(transferValue)
    })
  })

  describe("Auto-detection with 'type' field", () => {
    it("should auto-detect 'type' field in Union members", () => {
      const Circle = TSchema.Struct(
        {
          type: TSchema.Literal("Circle"),
          radius: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Square = TSchema.Struct(
        {
          type: TSchema.Literal("Square"),
          sideLength: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Shape = TSchema.Union(Circle, Square)

      const circleValue = { type: "Circle" as const, radius: 10n }
      const circleEncoded = Data.withSchema(Shape).toData(circleValue)

      expect(circleEncoded.index).toBe(0n)
      expect(circleEncoded.fields).toEqual([10n])

      const circleDecoded = Data.withSchema(Shape).fromData(circleEncoded)
      expect(circleDecoded).toEqual({ type: "Circle", radius: 10n })
    })
  })

  describe("Auto-detection with 'kind' field", () => {
    it("should auto-detect 'kind' field in Union members", () => {
      const Success = TSchema.Struct(
        {
          kind: TSchema.Literal("Success"),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Error = TSchema.Struct(
        {
          kind: TSchema.Literal("Error"),
          code: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Result = TSchema.Union(Success, Error)

      const successValue = { kind: "Success" as const, value: 42n }
      const encoded = Data.withSchema(Result).toData(successValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([42n])

      const decoded = Data.withSchema(Result).fromData(encoded)
      expect(decoded).toEqual({ kind: "Success", value: 42n })
    })
  })

  describe("Auto-detection with 'variant' field", () => {
    it("should auto-detect 'variant' field in Union members", () => {
      const Create = TSchema.Struct(
        {
          variant: TSchema.Literal("Create"),
          id: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Delete = TSchema.Struct(
        {
          variant: TSchema.Literal("Delete"),
          id: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Operation = TSchema.Union(Create, Delete)

      const createValue = { variant: "Create" as const, id: 123n }
      const encoded = Data.withSchema(Operation).toData(createValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([123n])

      const decoded = Data.withSchema(Operation).fromData(encoded)
      expect(decoded).toEqual({ variant: "Create", id: 123n })
    })
  })

  describe("TaggedStruct helper", () => {
    it("should create tagged structs with default _tag field", () => {
      const Deposit = TSchema.TaggedStruct(
        "Deposit",
        {
          amount: TSchema.Integer,
          account: TSchema.ByteArray
        },
        { flatInUnion: true, index: 0 }
      )

      const Withdrawal = TSchema.TaggedStruct(
        "Withdrawal",
        {
          amount: TSchema.Integer,
          account: TSchema.ByteArray
        },
        { flatInUnion: true, index: 1 }
      )

      const Payment = TSchema.Union(Deposit, Withdrawal)

      const depositValue = {
        _tag: "Deposit" as const,
        amount: 1000n,
        account: new Uint8Array([97, 108, 105, 99, 101]) // "alice"
      }

      const encoded = Data.withSchema(Payment).toData(depositValue)
      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toHaveLength(2) // amount and account, _tag stripped

      const decoded = Data.withSchema(Payment).fromData(encoded)
      expect(decoded).toEqual(depositValue)
    })

    it("should create tagged structs with custom tag field", () => {
      const Read = TSchema.TaggedStruct(
        "Read",
        {
          key: TSchema.ByteArray
        },
        { tagField: "operation", flatInUnion: true, index: 0 }
      )

      const Write = TSchema.TaggedStruct(
        "Write",
        {
          key: TSchema.ByteArray,
          value: TSchema.ByteArray
        },
        { tagField: "operation", flatInUnion: true, index: 1 }
      )

      const Command = TSchema.Union(Read, Write)

      const readValue = {
        operation: "Read" as const,
        key: new Uint8Array([1, 2, 3])
      }

      const encoded = Data.withSchema(Command).toData(readValue)
      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([new Uint8Array([1, 2, 3])])

      const decoded = Data.withSchema(Command).fromData(encoded)
      expect(decoded).toEqual(readValue)
    })

    it("should work with empty fields object", () => {
      const Start = TSchema.TaggedStruct("Start", {}, { flatInUnion: true, index: 0 })
      const Stop = TSchema.TaggedStruct("Stop", {}, { flatInUnion: true, index: 1 })

      const State = TSchema.Union(Start, Stop)

      const startValue = { _tag: "Start" as const }
      const encoded = Data.withSchema(State).toData(startValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toHaveLength(0)

      const decoded = Data.withSchema(State).fromData(encoded)
      expect(decoded).toEqual({ _tag: "Start" })
    })
  })

  describe("Type inference", () => {
    it("should infer discriminated union types correctly", () => {
      const Success = TSchema.TaggedStruct(
        "Success",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Failure = TSchema.TaggedStruct(
        "Failure",
        {
          error: TSchema.ByteArray
        },
        { flatInUnion: true, index: 1 }
      )

      const Result = TSchema.Union(Success, Failure)

      // TypeScript should infer the correct discriminated union type
      const successValue: typeof Result.Type = {
        _tag: "Success",
        value: 42n
      }

      const failureValue: typeof Result.Type = {
        _tag: "Failure",
        error: new Uint8Array([1, 2, 3])
      }

      expect(Data.withSchema(Result).toData(successValue)).toBeDefined()
      expect(Data.withSchema(Result).toData(failureValue)).toBeDefined()
    })
  })

  describe("Error handling", () => {
    it("should throw error on duplicate tag values", () => {
      const A = TSchema.Struct(
        {
          _tag: TSchema.Literal("Same"),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const B = TSchema.Struct(
        {
          _tag: TSchema.Literal("Same"),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      expect(() => TSchema.Union(A, B)).toThrow(/Union members must have unique tag values.*Duplicate value "Same"/)
    })

    it("should throw error on different tag field names", () => {
      const A = TSchema.Struct(
        {
          _tag: TSchema.Literal("A"),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const B = TSchema.Struct(
        {
          type: TSchema.Literal("B"),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      expect(() => TSchema.Union(A, B)).toThrow(
        /Union members must use the same tag field name.*Found multiple: _tag, type/
      )
    })

    it("should throw error when encoding invalid union value", () => {
      const A = TSchema.TaggedStruct("A", { x: TSchema.Integer }, { flatInUnion: true, index: 0 })
      const B = TSchema.TaggedStruct("B", { y: TSchema.Integer }, { flatInUnion: true, index: 1 })

      const AB = TSchema.Union(A, B)

      // @ts-expect-error - Testing invalid value
      expect(() => Data.withSchema(AB).toData({ _tag: "C", z: 1n })).toThrow()
    })
  })

  describe("Edge cases", () => {
    it("should handle union with more than 2 members", () => {
      const A = TSchema.TaggedStruct("A", { value: TSchema.Integer }, { flatInUnion: true, index: 0 })
      const B = TSchema.TaggedStruct("B", { value: TSchema.Integer }, { flatInUnion: true, index: 1 })
      const C = TSchema.TaggedStruct("C", { value: TSchema.Integer }, { flatInUnion: true, index: 2 })
      const D = TSchema.TaggedStruct("D", { value: TSchema.Integer }, { flatInUnion: true, index: 3 })

      const ABCD = TSchema.Union(A, B, C, D)

      const cValue = { _tag: "C" as const, value: 999n }
      const encoded = Data.withSchema(ABCD).toData(cValue)

      expect(encoded.index).toBe(2n)
      expect(encoded.fields).toEqual([999n])

      const decoded = Data.withSchema(ABCD).fromData(encoded)
      expect(decoded).toEqual(cValue)
    })

    it("should handle nested structs with tag fields", () => {
      const Inner = TSchema.Struct({
        value: TSchema.Integer
      })

      const Outer = TSchema.TaggedStruct(
        "Outer",
        {
          inner: Inner,
          extra: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Another = TSchema.TaggedStruct(
        "Another",
        {
          data: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Combined = TSchema.Union(Outer, Another)

      const outerValue = {
        _tag: "Outer" as const,
        inner: { value: 42n },
        extra: 100n
      }

      const encoded = Data.withSchema(Combined).toData(outerValue)
      expect(encoded.index).toBe(0n)

      const decoded = Data.withSchema(Combined).fromData(encoded)
      expect(decoded).toEqual(outerValue)
    })

    it("should work with explicit tagField option in Struct", () => {
      const X = TSchema.Struct(
        {
          status: TSchema.Literal("Active"),
          count: TSchema.Integer
        },
        { tagField: "status", flatInUnion: true, index: 0 }
      )

      const Y = TSchema.Struct(
        {
          status: TSchema.Literal("Inactive"),
          count: TSchema.Integer
        },
        { tagField: "status", flatInUnion: true, index: 1 }
      )

      const Status = TSchema.Union(X, Y)

      const activeValue = { status: "Active" as const, count: 5n }
      const encoded = Data.withSchema(Status).toData(activeValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([5n])

      const decoded = Data.withSchema(Status).fromData(encoded)
      expect(decoded).toEqual({ status: "Active", count: 5n })
    })

    it("should disable tag detection with tagField: false", () => {
      const WithTag = TSchema.Struct(
        {
          _tag: TSchema.Literal("HasTag"),
          value: TSchema.Integer
        },
        { tagField: false, flatInUnion: true, index: 0 }
      )

      const AlsoWithTag = TSchema.Struct(
        {
          _tag: TSchema.Literal("AlsoHasTag"),
          value: TSchema.Integer
        },
        { tagField: false, flatInUnion: true, index: 1 }
      )

      const NoAutoDetect = TSchema.Union(WithTag, AlsoWithTag)

      // When tagField is disabled, _tag is encoded as a regular field
      const value = { _tag: "HasTag" as const, value: 42n }
      const encoded = Data.withSchema(NoAutoDetect).toData(value)

      // _tag should be encoded as a field (Constr with index 0)
      expect(encoded.fields).toHaveLength(2)
    })

    it("should handle unions with no tag fields at all", () => {
      const A = TSchema.Struct({ x: TSchema.Integer }, { flatInUnion: true, index: 0 })

      const B = TSchema.Struct({ y: TSchema.Integer }, { flatInUnion: true, index: 1 })

      const AB = TSchema.Union(A, B)

      const aValue = { x: 10n }
      const encoded = Data.withSchema(AB).toData(aValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([10n])

      const decoded = Data.withSchema(AB).fromData(encoded)
      expect(decoded).toEqual({ x: 10n })
    })

    it("should handle tag field with numeric literal values", () => {
      const Zero = TSchema.Struct(
        {
          _tag: TSchema.Literal(0),
          data: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const One = TSchema.Struct(
        {
          _tag: TSchema.Literal(1),
          data: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const NumericTag = TSchema.Union(Zero, One)

      const zeroValue = { _tag: 0 as const, data: 100n }
      const encoded = Data.withSchema(NumericTag).toData(zeroValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([100n])

      const decoded = Data.withSchema(NumericTag).fromData(encoded)
      expect(decoded).toEqual({ _tag: 0, data: 100n })
    })

    it("should handle tag field with boolean literal values", () => {
      const TrueCase = TSchema.Struct(
        {
          _tag: TSchema.Literal(true),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const FalseCase = TSchema.Struct(
        {
          _tag: TSchema.Literal(false),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const BoolTag = TSchema.Union(TrueCase, FalseCase)

      const trueValue = { _tag: true, value: 42n }
      const encoded = Data.withSchema(BoolTag).toData(trueValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([42n])

      const decoded = Data.withSchema(BoolTag).fromData(encoded)
      expect(decoded).toEqual({ _tag: true, value: 42n })
    })

    it("should handle single member union with tag field", () => {
      const Only = TSchema.TaggedStruct(
        "Only",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Single = TSchema.Union(Only)

      const value = { _tag: "Only" as const, value: 123n }
      const encoded = Data.withSchema(Single).toData(value)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([123n])

      const decoded = Data.withSchema(Single).fromData(encoded)
      expect(decoded).toEqual({ _tag: "Only", value: 123n })
    })

    it("should handle mixed flatInUnion settings gracefully", () => {
      // One member is flat, another is not - should still detect tag field
      const Flat = TSchema.Struct(
        {
          _tag: TSchema.Literal("Flat"),
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const NotFlat = TSchema.Struct(
        {
          _tag: TSchema.Literal("NotFlat"),
          value: TSchema.Integer
        },
        { flatInUnion: false, index: 1 }
      )

      const Mixed = TSchema.Union(Flat, NotFlat)

      const flatValue = { _tag: "Flat" as const, value: 10n }
      const encoded = Data.withSchema(Mixed).toData(flatValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([10n]) // _tag stripped

      const decoded = Data.withSchema(Mixed).fromData(encoded)
      expect(decoded).toEqual({ _tag: "Flat", value: 10n })
    })

    it("should handle union members with different index values", () => {
      // Non-sequential indices
      const First = TSchema.TaggedStruct(
        "First",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 5 }
      )

      const Second = TSchema.TaggedStruct(
        "Second",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 10 }
      )

      const NonSeq = TSchema.Union(First, Second)

      const firstValue = { _tag: "First" as const, value: 100n }
      const encoded = Data.withSchema(NonSeq).toData(firstValue)

      expect(encoded.index).toBe(5n)
      expect(encoded.fields).toEqual([100n])

      const decoded = Data.withSchema(NonSeq).fromData(encoded)
      expect(decoded).toEqual({ _tag: "First", value: 100n })
    })

    it("should handle very long tag field names", () => {
      const longTag = "veryLongDiscriminatorFieldNameThatExceedsNormalLength"

      const A = TSchema.Struct(
        {
          [longTag]: TSchema.Literal("A"),
          data: TSchema.Integer
        },
        { tagField: longTag, flatInUnion: true, index: 0 }
      )

      const B = TSchema.Struct(
        {
          [longTag]: TSchema.Literal("B"),
          data: TSchema.Integer
        },
        { tagField: longTag, flatInUnion: true, index: 1 }
      )

      const LongTag = TSchema.Union(A, B)

      const value = { [longTag]: "A" as const, data: 42n }
      const encoded = Data.withSchema(LongTag).toData(value)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([42n])

      const decoded = Data.withSchema(LongTag).fromData(encoded)
      expect(decoded).toEqual({ [longTag]: "A", data: 42n })
    })

    it("should handle empty string as tag value", () => {
      const Empty = TSchema.TaggedStruct(
        "",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const NotEmpty = TSchema.TaggedStruct(
        "NotEmpty",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const EmptyTag = TSchema.Union(Empty, NotEmpty)

      const emptyValue = { _tag: "" as const, value: 123n }
      const encoded = Data.withSchema(EmptyTag).toData(emptyValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([123n])

      const decoded = Data.withSchema(EmptyTag).fromData(encoded)
      expect(decoded).toEqual({ _tag: "", value: 123n })
    })

    it("should handle unicode characters in tag values", () => {
      const Emoji = TSchema.TaggedStruct(
        "🎉",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Chinese = TSchema.TaggedStruct(
        "中文",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Unicode = TSchema.Union(Emoji, Chinese)

      const emojiValue = { _tag: "🎉" as const, value: 999n }
      const encoded = Data.withSchema(Unicode).toData(emojiValue)

      expect(encoded.index).toBe(0n)
      expect(encoded.fields).toEqual([999n])

      const decoded = Data.withSchema(Unicode).fromData(encoded)
      expect(decoded).toEqual({ _tag: "🎉", value: 999n })
    })
  })

  describe("Round-trip encoding/decoding", () => {
    it("should preserve data through encode/decode cycle", () => {
      const variants = [
        { _tag: "Mint" as const, amount: 100n },
        { _tag: "Burn" as const, amount: 50n },
        { _tag: "Transfer" as const, from: new Uint8Array([1]), to: new Uint8Array([2]), amount: 75n }
      ]

      const Mint = TSchema.TaggedStruct(
        "Mint",
        {
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Burn = TSchema.TaggedStruct(
        "Burn",
        {
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 1 }
      )

      const Transfer = TSchema.TaggedStruct(
        "Transfer",
        {
          from: TSchema.ByteArray,
          to: TSchema.ByteArray,
          amount: TSchema.Integer
        },
        { flatInUnion: true, index: 2 }
      )

      const Action = TSchema.Union(Mint, Burn, Transfer)

      for (const variant of variants) {
        const encoded = Data.withSchema(Action).toData(variant as any)
        const decoded = Data.withSchema(Action).fromData(encoded)
        expect(decoded).toEqual(variant)
      }
    })

    it("should handle CBOR hex round-trip", () => {
      const Success = TSchema.TaggedStruct(
        "Success",
        {
          value: TSchema.Integer
        },
        { flatInUnion: true, index: 0 }
      )

      const Failure = TSchema.TaggedStruct(
        "Failure",
        {
          error: TSchema.ByteArray
        },
        { flatInUnion: true, index: 1 }
      )

      const Result = TSchema.Union(Success, Failure)

      const successValue = { _tag: "Success" as const, value: 42n }

      const hex = Data.withSchema(Result).toCBORHex(successValue)
      expect(typeof hex).toBe("string")

      const decoded = Data.withSchema(Result).fromCBORHex(hex)
      expect(decoded).toEqual(successValue)
    })
  })
})
