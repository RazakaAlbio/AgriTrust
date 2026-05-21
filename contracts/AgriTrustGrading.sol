// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgriTrustGrading
 * @author Agri-Trust (Thesis Research · Edge-AI Commodity Grading System)
 * @notice Immutable on-chain audit trail for tomato commodity grading records.
 *
 * Each grading record is anchored via a SHA-256 hash of:
 *   { batchId + overallGrade + weightKg + gasPpm + timestamp }
 *
 * The hash is stored on-chain and emitted as an event. Consumers can verify
 * product authenticity by re-computing the hash from the Supabase data and
 * checking it against the on-chain record via PolygonScan or this contract.
 *
 * Access Control:
 *   - Owner: can authorize/revoke devices (Jetson Nano wallets)
 *   - Authorized devices + owner: can anchor grading records
 *   - Everyone: can read/verify records
 */
contract AgriTrustGrading {

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;

    struct GradingRecord {
        bytes32 sha256Hash;   // SHA-256 of the full grading payload
        string  overallGrade; // "Grade A" | "Grade B" | "Grade C" | "Reject"
        uint256 timestamp;    // block.timestamp when anchored
        address anchoredBy;   // device/wallet that submitted the tx
        bool    exists;       // sentinel to distinguish un-anchored batches
    }

    /// @dev batchId (e.g. "BATCH_2024_0847") → GradingRecord
    mapping(string => GradingRecord) private _records;

    /// @dev Authorized edge devices (Jetson Nano wallets)
    mapping(address => bool) private _authorizedDevices;

    // ─── Events ───────────────────────────────────────────────────────────────

    /**
     * @notice Emitted whenever a grading record is anchored on-chain.
     * @param batchId     The unique batch identifier.
     * @param sha256Hash  SHA-256 fingerprint of the grading payload.
     * @param overallGrade Human-readable grade ("Grade A", "Grade B", etc.)
     * @param timestamp   Block timestamp of anchoring.
     * @param anchoredBy  Address that submitted the transaction.
     */
    event GradingAnchored(
        string  indexed batchId,
        bytes32 indexed sha256Hash,
        string          overallGrade,
        uint256         timestamp,
        address indexed anchoredBy
    );

    event DeviceAuthorized(address indexed device);
    event DeviceRevoked(address indexed device);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "AgriTrust: caller is not the owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || _authorizedDevices[msg.sender],
            "AgriTrust: caller is not authorized"
        );
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── Write Functions ──────────────────────────────────────────────────────

    /**
     * @notice Anchor a grading record on-chain.
     * @dev Can only be called by the owner or an authorized device.
     *      A batch can only be anchored ONCE — subsequent calls revert.
     * @param batchId      Unique batch identifier (e.g. "BATCH_2024_0847").
     * @param sha256Hash   SHA-256 of {batchId+grade+weight+gas+timestamp} as bytes32.
     * @param overallGrade The AI-determined grade string.
     */
    function anchorGradingRecord(
        string  calldata batchId,
        bytes32          sha256Hash,
        string  calldata overallGrade
    ) external onlyAuthorized {
        require(bytes(batchId).length > 0,      "AgriTrust: batchId cannot be empty");
        require(sha256Hash != bytes32(0),        "AgriTrust: hash cannot be zero");
        require(bytes(overallGrade).length > 0,  "AgriTrust: grade cannot be empty");
        require(!_records[batchId].exists,       "AgriTrust: batch already anchored");

        _records[batchId] = GradingRecord({
            sha256Hash:   sha256Hash,
            overallGrade: overallGrade,
            timestamp:    block.timestamp,
            anchoredBy:   msg.sender,
            exists:       true
        });

        emit GradingAnchored(batchId, sha256Hash, overallGrade, block.timestamp, msg.sender);
    }

    /**
     * @notice Authorize an edge device (Jetson Nano wallet) to anchor records.
     * @param device The wallet address of the edge device.
     */
    function authorizeDevice(address device) external onlyOwner {
        require(device != address(0), "AgriTrust: zero address");
        _authorizedDevices[device] = true;
        emit DeviceAuthorized(device);
    }

    /**
     * @notice Revoke an edge device's authorization.
     * @param device The wallet address to revoke.
     */
    function revokeDevice(address device) external onlyOwner {
        _authorizedDevices[device] = false;
        emit DeviceRevoked(device);
    }

    /**
     * @notice Transfer contract ownership.
     * @param newOwner The address of the new owner.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AgriTrust: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Read Functions ───────────────────────────────────────────────────────

    /**
     * @notice Verify a grading record by batchId.
     * @param batchId The batch identifier to look up.
     * @return sha256Hash   The SHA-256 hash anchored on-chain.
     * @return overallGrade The grade string.
     * @return timestamp    Unix timestamp when anchored.
     * @return anchoredBy   Address that submitted the anchor transaction.
     * @return exists       True if this batch has been anchored.
     */
    function verifyRecord(string calldata batchId)
        external
        view
        returns (
            bytes32 sha256Hash,
            string  memory overallGrade,
            uint256 timestamp,
            address anchoredBy,
            bool    exists
        )
    {
        GradingRecord storage r = _records[batchId];
        return (r.sha256Hash, r.overallGrade, r.timestamp, r.anchoredBy, r.exists);
    }

    /**
     * @notice Check if a specific hash matches the anchored record for a batch.
     * @dev Useful for tamper-detection: re-compute hash off-chain, then call this.
     * @param batchId    The batch identifier.
     * @param sha256Hash The hash to verify against the anchored value.
     * @return True if the hash matches and the record exists.
     */
    function verifyHash(string calldata batchId, bytes32 sha256Hash)
        external
        view
        returns (bool)
    {
        GradingRecord storage r = _records[batchId];
        return r.exists && r.sha256Hash == sha256Hash;
    }

    /**
     * @notice Check if an address is authorized to anchor records.
     * @param device The address to check.
     * @return True if authorized.
     */
    function isAuthorized(address device) external view returns (bool) {
        return device == owner || _authorizedDevices[device];
    }
}
