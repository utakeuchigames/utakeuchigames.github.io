/**
 * Turbowarpの『カスタム拡張機能』を使おう【１】
 * 基本構造 blockの配列
 */
((Scratch) => {
    const MyExtensionInfo = {
        id : "MYEXTENSION", 
        name : "独自拡張練習",
        blocks : [
            {
                opcode : 'block02',
                blockType : Scratch.BlockType.COMMAND,
                text : 'ブロック０２ [TEXT]',
                arguments: {
                    TEXT : {
                        type: Scratch.ArgumentType.STRING,
                        defaultValue: 'あいうえお',
                    }
                }
            }
        ]
    }

    class MyExtension {
        getInfo() {
            return MyExtensionInfo;
        }
        block02( args, util ) {
            console.log( 'block02 TEXT=', args.TEXT );
        }
    }

    Scratch.extensions.register(new MyExtension());

})(Scratch);


