import type { LatLng, Order, OrderId } from '../types.ts'
import { deleteOrderRow } from './cascade.ts'
import { must, mutate, newId, query, type Db } from './db.ts'
import { geocode } from './geocode.ts'
import { optionalText, requireCount, requireText, requireWindow } from './validate.ts'

/** What the dispatcher types for a stop. The address is placed on the map when it is saved. */
export type OrderInput = Pick<Order, 'customer' | 'phone' | 'addressRaw' | 'quantity' | 'serviceMinutes' | 'window' | 'notes'>

/** How the dispatcher fixes an address that needs a check or was not found. */
export type LocationFix = { kind: 'candidate'; index: number } | { kind: 'pin'; location: LatLng; address: string }

export function checkedOrder(input: OrderInput): OrderInput {
  return {
    customer: requireText(input.customer, 'Customer name'),
    addressRaw: requireText(input.addressRaw, 'Address'),
    phone: optionalText(input.phone),
    quantity: requireCount(input.quantity, 'Load'),
    serviceMinutes: input.serviceMinutes === null ? null : requireCount(input.serviceMinutes, 'Service time', 0),
    window: input.window && requireWindow(input.window, 'Time window'),
    notes: input.notes.trim(),
  }
}

export function newOrder(input: OrderInput, importId: Order['importId']): Order {
  const valid = checkedOrder(input)
  return { id: newId('order'), ...valid, geocode: geocode(valid.addressRaw), importId }
}

export const listOrders = () => query((db) => db.order)

export const getOrder = (orderId: OrderId) => query((db) => must(db.order, orderId, 'stop'))

export const createOrder = (input: OrderInput) =>
  mutate((db) => {
    const order = newOrder(input, null)
    db.order.push(order)
    return order
  })

/** A changed address is placed on the map again. */
export const updateOrder = (orderId: OrderId, patch: Partial<OrderInput>) =>
  mutate((db) => {
    const order = must(db.order, orderId, 'stop')
    const next = checkedOrder({ ...order, ...patch })
    Object.assign(order, next, next.addressRaw !== order.addressRaw ? { geocode: geocode(next.addressRaw) } : {})
    return order
  })

/** Confirms one of the candidate places, or a pin the dispatcher dropped on the map. */
export const fixOrderLocation = (orderId: OrderId, fix: LocationFix) =>
  mutate((db) => {
    const order = must(db.order, orderId, 'stop')
    if (fix.kind === 'pin') {
      order.geocode = { status: 'manual', address: requireText(fix.address, 'Address'), location: fix.location }
      return order
    }
    const candidate = order.geocode.status === 'check' ? order.geocode.candidates[fix.index] : undefined
    if (!candidate) throw new Error('That place is no longer offered. Drop a pin on the map instead.')
    order.geocode = { status: 'ok', address: candidate.address, location: candidate.location }
    return order
  })

/** Throws when the stop is on a sent route. Draft plans drop the stop. */
export const deleteOrder = (orderId: OrderId) => mutate((db) => deleteOrderRow(db, orderId))

/** Deletes several stops. Nothing is deleted if any of them is on a sent route. */
export const deleteOrders = (orderIds: OrderId[]) =>
  mutate((db: Db) => {
    for (const orderId of orderIds) deleteOrderRow(db, orderId)
  })
