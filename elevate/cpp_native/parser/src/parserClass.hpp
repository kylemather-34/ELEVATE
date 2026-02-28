#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <fstream>
#include <stack>

using namespace std;

// Enum of all different python block types
enum class BlockType { CLASS, FUNCTION, IF, ELIF, ELSE, FOR, WHILE, TRY, EXCEPT, WITH, UNKNOWN };

// Block structure
struct BlockEvent {
    bool isStart; //true = start, false = end
    BlockType type;
    int lineNumber;
    int indentLevel;
    string lineText;
};

// structure only for nesting tracking
struct ActiveBlock {
    BlockType type;
    int indentLevel;
};

string blockTypeToString(BlockType type); // Returns the type of the block as a string

class Parser {
    public:
        Parser() = default;
        ~Parser() = default;

        vector<BlockEvent> parseFile(ifstream& file); // Reads the file and returns a vector of all block events

    private:
        int countIndent(const string& line);      // Counts leading whitespace to determine indentation level
        string trim(const string& line);          // Removes leading and trailing whitespace
        bool startBlock(const string& line);      // Determines the start of each block
        BlockType detectType(const string& line); // Determines the type of each block
};