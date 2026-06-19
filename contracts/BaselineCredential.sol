// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// MODEL A: The "Expensive" Baseline
// Stores full student data directly on blockchain (Bad for privacy & cost)
contract BaselineCredential is ERC721, Ownable {
    uint256 private _nextTokenId;

    struct StudentData {
        string name;
        string degree;
        string gpa;     // Storing GPA publicly! (Privacy violation)
        string graduationDate;
    }

    // Mapping ID -> Full Data struct
    mapping(uint256 => StudentData) public records;

    constructor(address initialOwner)
        ERC721("BaselineDegree", "BDEG")
        Ownable(initialOwner)
    {}

    // This function will be VERY expensive because it stores strings
    function issueCredential(
        address student, 
        string memory _name, 
        string memory _degree, 
        string memory _gpa, 
        string memory _date
    ) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(student, tokenId);
        
        records[tokenId] = StudentData(_name, _degree, _gpa, _date);
    }
}