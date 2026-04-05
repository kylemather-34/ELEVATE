#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <fstream>
#include <stack>

using namespace std;

// Enum of all different python block types
enum class BlockType
{
    CLASS,
    FUNCTION,
    IF,
    ELIF,
    ELSE,
    FOR,
    WHILE,
    TRY,
    EXCEPT,
    WITH,
    UNKNOWN
};

//Type of event
enum class EventKind
{
    START,
    END,
    LINE
};

// Block structure
struct BlockEvent
{
    EventKind kind;
    BlockType type;
    int lineNumber;
    int indentLevel;
    string lineText;
};

// structure only for nesting tracking
struct ActiveBlock
{
    BlockType type;
    int indentLevel;
};

string blockTypeToString(BlockType type); // Returns the type of the block as a string

namespace Parser
{
    vector<BlockEvent> parseFile(ifstream &file); // Reads the file and returns a vector of all block events
    int countIndent(const string &line);          // Counts leading whitespace to determine indentation level
    string trim(const string &line);              // Removes leading and trailing whitespace
    string stripComment(const string &line);      // Removes inline and full line comments
    string sanitizeText(const string &line);      // Removes non printable control characters
    bool startBlock(const string &line);          // Determines the start of each block
    BlockType detectType(const string &line);     // Determines the type of each block
};