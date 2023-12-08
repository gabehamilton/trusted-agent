// Find all our documentation at https://docs.near.org
import { NearBindgen, NearPromise, near, call, view, Vector, assert} from 'near-sdk-js';
import { AccountId } from 'near-sdk-js/lib/types'

@NearBindgen({})
class FlightPurchase {
  purchaseHistory: string = "history";
  
  @view({}) // This method is read-only and can be called for free
  get_flights(): string {
    return this.purchaseHistory;
  }
  
  @call({}) // This method logs flight purchase info to chain
  purchase_flight({ to, flight_text }: { to: AccountId, flight_text: string }) {
    const flightInfo = `${flight_text}`;
    near.log(flightInfo)
    this.purchaseHistory += flightInfo
  }
}