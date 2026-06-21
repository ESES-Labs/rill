#[test_only]
module agent_wallet::agent_wallet_tests {
    use sui::test_scenario as ts;
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock;
    use agent_wallet::agent_wallet::{Self as aw, AgentWallet, AgentCap};

    const OWNER: address = @0xA;
    const AGENT: address = @0xB;
    const PKG_A: address = @0xCAFE;
    const PKG_B: address = @0xBEEF;

    // Mirror the module's abort codes (constants are module-private) for expected_failure.
    const E_NOT_OWNER: u64 = 1;
    const E_REVOKED: u64 = 2;
    const E_EXPIRED: u64 = 3;
    const E_OVER_PER_TX: u64 = 4;
    const E_OVER_BUDGET: u64 = 5;
    const E_ZERO_AMOUNT: u64 = 7;

    fun create(scenario: &mut ts::Scenario, amount: u64, per_tx: u64, expiry: u64, allowed: vector<address>) {
        ts::next_tx(scenario, OWNER);
        let ctx = ts::ctx(scenario);
        let funds = coin::mint_for_testing<SUI>(amount, ctx);
        aw::create_wallet<SUI>(funds, AGENT, per_tx, expiry, allowed, ctx);
    }

    // ── happy path: spend within caps, views update ──
    #[test]
    fun spend_within_caps_updates_views() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);

        ts::next_tx(&mut sc, AGENT);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let cap = ts::take_from_sender<AgentCap>(&sc);
        let mut clk = clock::create_for_testing(ts::ctx(&mut sc));
        clk.set_for_testing(1000);

        assert!(aw::remaining(&wallet) == 1000, 100);
        assert!(aw::is_active(&wallet, &clk), 101);

        let out1 = aw::spend<SUI>(&mut wallet, &cap, 300, &clk, ts::ctx(&mut sc));
        assert!(coin::value(&out1) == 300, 102);
        assert!(aw::remaining(&wallet) == 700, 103);
        assert!(aw::spent(&wallet) == 300, 104);

        let out2 = aw::spend<SUI>(&mut wallet, &cap, 200, &clk, ts::ctx(&mut sc));
        assert!(aw::remaining(&wallet) == 500, 105);
        assert!(aw::spent(&wallet) == 500, 106);

        coin::burn_for_testing(out1);
        coin::burn_for_testing(out2);
        clock::destroy_for_testing(clk);
        ts::return_shared(wallet);
        ts::return_to_sender(&sc, cap);
        ts::end(sc);
    }

    // ── over per-tx cap → E_OVER_PER_TX ──
    #[test, expected_failure(abort_code = E_OVER_PER_TX, location = aw)]
    fun spend_over_per_tx_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);
        ts::next_tx(&mut sc, AGENT);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let cap = ts::take_from_sender<AgentCap>(&sc);
        let mut clk = clock::create_for_testing(ts::ctx(&mut sc));
        clk.set_for_testing(1000);
        let out = aw::spend<SUI>(&mut wallet, &cap, 600, &clk, ts::ctx(&mut sc)); // 600 > 500
        coin::burn_for_testing(out);
        clock::destroy_for_testing(clk);
        ts::return_shared(wallet);
        ts::return_to_sender(&sc, cap);
        ts::end(sc);
    }

    // ── over total budget → E_OVER_BUDGET ──
    #[test, expected_failure(abort_code = E_OVER_BUDGET, location = aw)]
    fun spend_over_budget_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 5000, 10_000, vector[]);
        ts::next_tx(&mut sc, AGENT);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let cap = ts::take_from_sender<AgentCap>(&sc);
        let mut clk = clock::create_for_testing(ts::ctx(&mut sc));
        clk.set_for_testing(1000);
        let out = aw::spend<SUI>(&mut wallet, &cap, 2000, &clk, ts::ctx(&mut sc)); // <=per_tx but >budget
        coin::burn_for_testing(out);
        clock::destroy_for_testing(clk);
        ts::return_shared(wallet);
        ts::return_to_sender(&sc, cap);
        ts::end(sc);
    }

    // ── zero amount → E_ZERO_AMOUNT ──
    #[test, expected_failure(abort_code = E_ZERO_AMOUNT, location = aw)]
    fun spend_zero_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);
        ts::next_tx(&mut sc, AGENT);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let cap = ts::take_from_sender<AgentCap>(&sc);
        let mut clk = clock::create_for_testing(ts::ctx(&mut sc));
        clk.set_for_testing(1000);
        let out = aw::spend<SUI>(&mut wallet, &cap, 0, &clk, ts::ctx(&mut sc));
        coin::burn_for_testing(out);
        clock::destroy_for_testing(clk);
        ts::return_shared(wallet);
        ts::return_to_sender(&sc, cap);
        ts::end(sc);
    }

    // ── expired → E_EXPIRED ──
    #[test, expected_failure(abort_code = E_EXPIRED, location = aw)]
    fun spend_after_expiry_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);
        ts::next_tx(&mut sc, AGENT);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let cap = ts::take_from_sender<AgentCap>(&sc);
        let mut clk = clock::create_for_testing(ts::ctx(&mut sc));
        clk.set_for_testing(10_000); // ts == expiry → not (ts < expiry) → expired
        assert!(!aw::is_active(&wallet, &clk), 200);
        let out = aw::spend<SUI>(&mut wallet, &cap, 100, &clk, ts::ctx(&mut sc));
        coin::burn_for_testing(out);
        clock::destroy_for_testing(clk);
        ts::return_shared(wallet);
        ts::return_to_sender(&sc, cap);
        ts::end(sc);
    }

    // ── revoke reclaims funds + future spend aborts (E_REVOKED) ──
    #[test, expected_failure(abort_code = E_REVOKED, location = aw)]
    fun spend_after_revoke_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);

        ts::next_tx(&mut sc, OWNER);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let reclaimed = aw::revoke<SUI>(&mut wallet, ts::ctx(&mut sc));
        assert!(coin::value(&reclaimed) == 1000, 300);
        assert!(aw::remaining(&wallet) == 0, 301);
        coin::burn_for_testing(reclaimed);
        ts::return_shared(wallet);

        ts::next_tx(&mut sc, AGENT);
        let mut wallet2 = ts::take_shared<AgentWallet<SUI>>(&sc);
        let cap = ts::take_from_sender<AgentCap>(&sc);
        let mut clk = clock::create_for_testing(ts::ctx(&mut sc));
        clk.set_for_testing(1000);
        let out = aw::spend<SUI>(&mut wallet2, &cap, 100, &clk, ts::ctx(&mut sc));
        coin::burn_for_testing(out);
        clock::destroy_for_testing(clk);
        ts::return_shared(wallet2);
        ts::return_to_sender(&sc, cap);
        ts::end(sc);
    }

    // ── revoke by non-owner → E_NOT_OWNER ──
    #[test, expected_failure(abort_code = E_NOT_OWNER, location = aw)]
    fun revoke_by_non_owner_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);
        ts::next_tx(&mut sc, AGENT); // agent is not the owner
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let reclaimed = aw::revoke<SUI>(&mut wallet, ts::ctx(&mut sc));
        coin::burn_for_testing(reclaimed);
        ts::return_shared(wallet);
        ts::end(sc);
    }

    // ── top_up by owner increases budget ──
    #[test]
    fun top_up_increases_budget() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);
        ts::next_tx(&mut sc, OWNER);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let more = coin::mint_for_testing<SUI>(500, ts::ctx(&mut sc));
        aw::top_up<SUI>(&mut wallet, more, ts::ctx(&mut sc));
        assert!(aw::remaining(&wallet) == 1500, 400);
        ts::return_shared(wallet);
        ts::end(sc);
    }

    // ── top_up by non-owner → E_NOT_OWNER ──
    #[test, expected_failure(abort_code = E_NOT_OWNER, location = aw)]
    fun top_up_by_non_owner_aborts() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[]);
        ts::next_tx(&mut sc, AGENT);
        let mut wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        let more = coin::mint_for_testing<SUI>(500, ts::ctx(&mut sc));
        aw::top_up<SUI>(&mut wallet, more, ts::ctx(&mut sc));
        ts::return_shared(wallet);
        ts::end(sc);
    }

    // ── allowed_packages scope view: empty = allow all; non-empty = membership ──
    #[test]
    fun is_allowed_scope_logic() {
        let mut sc = ts::begin(OWNER);
        create(&mut sc, 1000, 500, 10_000, vector[PKG_A]);
        ts::next_tx(&mut sc, AGENT);
        let wallet = ts::take_shared<AgentWallet<SUI>>(&sc);
        assert!(aw::is_allowed(&wallet, PKG_A), 500);   // listed
        assert!(!aw::is_allowed(&wallet, PKG_B), 501);  // not listed
        assert!(aw::allowed_packages(&wallet) == vector[PKG_A], 502);
        ts::return_shared(wallet);
        ts::end(sc);

        let mut sc2 = ts::begin(OWNER);
        create(&mut sc2, 1000, 500, 10_000, vector[]); // empty = allow any
        ts::next_tx(&mut sc2, AGENT);
        let w2 = ts::take_shared<AgentWallet<SUI>>(&sc2);
        assert!(aw::is_allowed(&w2, PKG_A), 503);
        assert!(aw::is_allowed(&w2, PKG_B), 504);
        ts::return_shared(w2);
        ts::end(sc2);
    }
}
