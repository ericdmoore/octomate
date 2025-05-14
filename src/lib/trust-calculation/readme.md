Calculating a Trust Score
=========================


Single Player Mode
----------------------

- Domain + Individual Behaviors
- Domains help bot strap unknown senders

- Email Platforms vs Companies
- Companies are Scored as an entity just like people
- Email Platforms convey very little by way of trust


Paradigm Shift
----------------------
Share my TrustGraph with my < Circle of Trust > This enables a NEW Chain of Trust Mode
----------------------

Chain of Trust Mode

Trust Score = introducer.trustLevel * decay(hops);



There are other things called - `endorsements` where there 

To bootstrap trust using these sidecar artifacts:
- Extract the payload (from headers, mime, or footer)
- Parse and cache sender's public key
- Check for endorsements (e.g., signedBy someone I trust)
- Build or reinforce trust edges in the TrustGraph

```mermaid
graph LR
  subgraph User Graph
    Alice["Alice<br/>(Fully Trusted)"]
    Bob["Bob<br/>(Signed by Alice)"]
    Carol["Carol<br/>(Signed by Bob)"]
    Dave["Dave<br/>(No trusted path)"]
  end

  Alice -->|Signs| Bob
  Bob -->|Signs| Carol
  Carol -->|Signs| Dave

  classDef trusted fill:#c1f0c1,stroke:#2b7a2b,color:#000
  classDef marginal fill:#fef3bd,stroke:#9a8320,color:#000
  classDef untrusted fill:#fdd,stroke:#800,color:#000

  class Alice trusted
  class Bob marginal
  class Carol marginal
  class Dave untrusted

```