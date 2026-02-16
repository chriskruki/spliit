import { RecurrenceRule, SettlementMode, SplitMode } from '@prisma/client'
import Decimal from 'decimal.js'

import * as z from 'zod'

export const groupFormSchema = z
  .object({
    name: z.string().min(2, 'min2').max(50, 'max50'),
    information: z.string().optional(),
    currency: z.string().min(1, 'min1').max(5, 'max5'),
    currencyCode: z.union([z.string().length(3).nullish(), z.literal('')]), // ISO-4217 currency code
    participants: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().min(2, 'min2').max(50, 'max50'),
        }),
      )
      .min(1),
  })
  .superRefine(({ participants }, ctx) => {
    participants.forEach((participant, i) => {
      participants.slice(0, i).forEach((otherParticipant) => {
        if (otherParticipant.name === participant.name) {
          ctx.addIssue({
            code: 'custom',
            message: 'duplicateParticipantName',
            path: ['participants', i, 'name'],
          })
        }
      })
    })
  })

export type GroupFormValues = z.infer<typeof groupFormSchema>

const inputCoercedToNumber = z.union([
  z.number(),
  z.string().transform((value, ctx) => {
    const valueAsNumber = Number(value)
    if (Number.isNaN(valueAsNumber))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalidNumber',
      })
    return valueAsNumber
  }),
])

export const expenseFormSchema = z
  .object({
    expenseDate: z.coerce.date(),
    title: z.string({ required_error: 'titleRequired' }).min(2, 'min2'),
    category: z.coerce.number().default(0),
    amount: z
      .union(
        [
          z.number(),
          z.string().transform((value, ctx) => {
            const valueAsNumber = Number(value)
            if (Number.isNaN(valueAsNumber))
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'invalidNumber',
              })
            return valueAsNumber
          }),
        ],
        { required_error: 'amountRequired' },
      )
      .refine((amount) => amount != 0, 'amountNotZero')
      .refine((amount) => amount <= 10_000_000_00, 'amountTenMillion'),
    originalAmount: z
      .union([
        z.literal('').transform(() => undefined),
        inputCoercedToNumber
          .refine((amount) => amount != 0, 'amountNotZero')
          .refine((amount) => amount <= 10_000_000_00, 'amountTenMillion'),
      ])
      .optional(),
    originalCurrency: z.union([z.string().length(3).nullish(), z.literal('')]),
    conversionRate: z
      .union([
        z.literal('').transform(() => undefined),
        inputCoercedToNumber.refine((amount) => amount > 0, 'ratePositive'),
      ])
      .optional(),
    paidBy: z.string({ required_error: 'paidByRequired' }),
    paidFor: z
      .array(
        z.object({
          participant: z.string(),
          originalAmount: z.string().optional(), // For converting shares by amounts in original currency, not saved.
          shares: z.union([
            z.number(),
            z.string().transform((value, ctx) => {
              const normalizedValue = value.replace(/,/g, '.')
              const valueAsNumber = Number(normalizedValue)
              if (Number.isNaN(valueAsNumber))
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: 'invalidNumber',
                })
              return value
            }),
          ]),
        }),
      )
      .min(1, 'paidForMin1')
      .superRefine((paidFor, ctx) => {
        for (const { shares } of paidFor) {
          const shareNumber = Number(shares)
          if (shareNumber <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'noZeroShares',
            })
          }
        }
      }),
    splitMode: z
      .enum<SplitMode, [SplitMode, ...SplitMode[]]>(
        Object.values(SplitMode) as any,
      )
      .default('EVENLY'),
    saveDefaultSplittingOptions: z.boolean(),
    isReimbursement: z.boolean(),
    documents: z
      .array(
        z.object({
          id: z.string(),
          url: z.string().url(),
          width: z.number().int().min(1),
          height: z.number().int().min(1),
        }),
      )
      .default([]),
    notes: z.string().optional(),
    recurrenceRule: z
      .enum<RecurrenceRule, [RecurrenceRule, ...RecurrenceRule[]]>(
        Object.values(RecurrenceRule) as any,
      )
      .default('NONE'),
    settlementMode: z
      .enum<SettlementMode, [SettlementMode, ...SettlementMode[]]>(
        Object.values(SettlementMode) as any,
      )
      .default('NORMAL'),
    leaseItemName: z.string().optional(),
    leaseOwnerId: z.string().optional(),
    leaseBuybackDate: z.coerce.date().optional(),
    subItems: z
      .array(
        z.object({
          id: z.string().optional(),
          title: z.string().min(1, 'titleRequired'),
          amount: z.union([
            z.number(),
            z.string().transform((value, ctx) => {
              const valueAsNumber = Number(value)
              if (Number.isNaN(valueAsNumber))
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: 'invalidNumber',
                })
              return valueAsNumber
            }),
          ]),
          splitMode: z
            .enum<SplitMode, [SplitMode, ...SplitMode[]]>(
              Object.values(SplitMode) as any,
            )
            .default('EVENLY'),
          paidFor: z
            .array(
              z.object({
                participant: z.string(),
                shares: z.union([
                  z.number(),
                  z.string().transform((value, ctx) => {
                    const normalizedValue = value.replace(/,/g, '.')
                    const valueAsNumber = Number(normalizedValue)
                    if (Number.isNaN(valueAsNumber))
                      ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: 'invalidNumber',
                      })
                    return value
                  }),
                ]),
              }),
            )
            .min(1, 'paidForMin1'),
        }),
      )
      .default([]),
  })
  .superRefine((expense, ctx) => {
    if (expense.settlementMode === 'LEASE') {
      if (!expense.leaseOwnerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'leaseOwnerRequired',
          path: ['leaseOwnerId'],
        })
      }
      if (!expense.leaseItemName || expense.leaseItemName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'leaseItemNameRequired',
          path: ['leaseItemName'],
        })
      }
      if (!expense.leaseBuybackDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'leaseBuybackDateRequired',
          path: ['leaseBuybackDate'],
        })
      }
    }

    switch (expense.splitMode) {
      case 'EVENLY':
        break // noop
      case 'BY_SHARES':
        break // noop
      case 'BY_AMOUNT': {
        const sum = expense.paidFor.reduce(
          (sum, { shares }) => new Decimal(shares).add(sum),
          new Decimal(0),
        )
        if (!sum.equals(new Decimal(expense.amount))) {
          // const detail =
          //   sum < expense.amount
          //     ? `${((expense.amount - sum) / 100).toFixed(2)} missing`
          //     : `${((sum - expense.amount) / 100).toFixed(2)} surplus`
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'amountSum',
            path: ['paidFor'],
          })
        }
        break
      }
      case 'BY_PERCENTAGE': {
        const sum = expense.paidFor.reduce(
          (sum, { shares }) =>
            sum +
            (typeof shares === 'string'
              ? Math.round(Number(shares) * 100)
              : Number(shares)),
          0,
        )
        if (sum !== 10000) {
          const detail =
            sum < 10000
              ? `${((10000 - sum) / 100).toFixed(0)}% missing`
              : `${((sum - 10000) / 100).toFixed(0)}% surplus`
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'percentageSum',
            path: ['paidFor'],
          })
        }
        break
      }
    }

    // Sub-item validation
    if (expense.subItems && expense.subItems.length > 0) {
      const subItemTotal = expense.subItems.reduce(
        (sum, si) => new Decimal(si.amount).add(sum),
        new Decimal(0),
      )
      if (subItemTotal.greaterThan(new Decimal(expense.amount))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'subItemsTotalExceeded',
          path: ['subItems'],
        })
      }

      expense.subItems.forEach((subItem, i) => {
        switch (subItem.splitMode) {
          case 'BY_AMOUNT': {
            const sum = subItem.paidFor.reduce(
              (sum, { shares }) => new Decimal(shares).add(sum),
              new Decimal(0),
            )
            if (!sum.equals(new Decimal(subItem.amount))) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'amountSum',
                path: ['subItems', i, 'paidFor'],
              })
            }
            break
          }
          case 'BY_PERCENTAGE': {
            const sum = subItem.paidFor.reduce(
              (sum, { shares }) =>
                sum +
                (typeof shares === 'string'
                  ? Math.round(Number(shares) * 100)
                  : Number(shares)),
              0,
            )
            if (sum !== 10000) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'percentageSum',
                path: ['subItems', i, 'paidFor'],
              })
            }
            break
          }
        }
      })
    }
  })
  .transform((expense) => {
    // Format the share split as a number (if from form submission)
    const transformPaidFor = (
      paidFor: typeof expense.paidFor,
      splitMode: typeof expense.splitMode,
    ) =>
      paidFor.map((pf) => {
        const shares = pf.shares
        if (typeof shares === 'string' && splitMode !== 'BY_AMOUNT') {
          return { ...pf, shares: Math.round(Number(shares) * 100) }
        }
        return { ...pf, shares: Number(shares) }
      })

    return {
      ...expense,
      paidFor: transformPaidFor(expense.paidFor, expense.splitMode),
      subItems: expense.subItems.map((subItem) => ({
        ...subItem,
        paidFor: transformPaidFor(subItem.paidFor, subItem.splitMode),
      })),
    }
  })

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

export type SplittingOptions = {
  // Used for saving default splitting options in localStorage
  splitMode: SplitMode
  paidFor: ExpenseFormValues['paidFor'] | null
}
