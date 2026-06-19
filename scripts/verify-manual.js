const { ethers } = require("hardhat");

async function main() {
    // ----------------------------------------------------
    // 1. SETUP - Replace with your data
    // ----------------------------------------------------
    const VERIFIER_ADDR = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // Your Verifier Address
    
    // PASTE THE FULL JSON FROM YOUR STUDENT DASHBOARD HERE:
    const proofData = {
        "proof": {
            "pi_a": ["2507122752062994189056931844321160859560101816633302197104953923518773051128", "16534701501630211000324358715540751992136164349166337143583553766654634702411", "1"],
            "pi_b": [["1663752990406119760219369012418334615868061892352510404291888944705401651006", "17459344084838504124544853812671006432934821032768920637641224117274930356327"], ["3558819306359671460608322326778745798300658418137963931556851778826565189683", "12016774890105681870127060600503773429053344843986855480659678825551505711722"], ["1", "0"]],
            "pi_c": ["19369077428214237609022121058825233132434180810060530597004631377141096078695", "3783273529657175905093219131522848561032091133215363325576236155295427857738", "1"],
            "protocol": "groth16",
            "curve": "bn128"
        },
        "publicSignals": ["16552558775889546132050394258295542513161940552363399268378794182012646403153"]
    };
    // (Ensure you replace the object above with the actual copied JSON from your browser)

    console.log("🔍 Converting Proof for Blockchain...");

    // ----------------------------------------------------
    // 2. FORMATTING (The Tricky Part)
    // ----------------------------------------------------
    // SnarkJS returns data in a way that needs swapping for Solidity
    const pA = [
        proofData.proof.pi_a[0], 
        proofData.proof.pi_a[1]
    ];
    const pB = [
        [proofData.proof.pi_b[0][1], proofData.proof.pi_b[0][0]], // Must swap [0][1] and [0][0]
        [proofData.proof.pi_b[1][1], proofData.proof.pi_b[1][0]]  // Must swap [1][1] and [1][0]
    ];
    const pC = [
        proofData.proof.pi_c[0], 
        proofData.proof.pi_c[1]
    ];
    const pubSignals = proofData.publicSignals;

    // ----------------------------------------------------
    // 3. EXECUTION
    // ----------------------------------------------------
    console.log(`🔌 Connecting to Verifier at ${VERIFIER_ADDR}...`);
    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = Verifier.attach(VERIFIER_ADDR);

    try {
        // We use staticCall to simulate the transaction and get the return value
        const result = await verifier.verifyProof.staticCall(pA, pB, pC, pubSignals);
        
        if (result === true) {
            console.log("✅ SUCCESS: The Proof is VALID!");
        } else {
            console.log("❌ FAILURE: The Proof is INVALID (Math check failed).");
        }
    } catch (error) {
        console.error("\n❌ CRITICAL ERROR (Revert):");
        console.error(error.reason || error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});