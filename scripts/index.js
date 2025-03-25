import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from '@minecraft/server-ui'


let setTimer = 1200
let timer = 1200
let effect = false
let players = new Map()

// Game running

const tick = () => system.run( () => {

    const milliseconds = ( timer * 5 ) % 100 < 10 ? '0' + ( timer * 5 ) % 100 : ( timer * 5 ) % 100
    const seconds      = Math.floor( timer / 20 ) % 60 < 10 ? '0' + Math.floor( timer / 20 ) % 60 : Math.floor( timer / 20 ) % 60
    const minutes      = Math.floor( timer / 1200 ) % 60 < 10 ? '0' + Math.floor( timer / 1200 ) % 60 : Math.floor( timer / 1200 ) % 60

    for ( const player of world.getPlayers() ) player.onScreenDisplay.setActionBar( `${minutes}:${seconds}:${milliseconds}` )

    if ( Array.from( players ).filter( ( [ name, value ] ) => value.team == 'green' && value.alive ).length == 0 ) return endGame()
    if ( timer == 0 ) return endGame( 'green' )
    if ( timer == 300 ) world.playMusic( 'pkt:overtime', { fade: 1, volume: 1, loop: false } )

    timer--

    tick()
} )

// Game starting sequence

const start = () => {
    world.getDimension( 'overworld' ).runCommandAsync( 'clear @a' )
    world.getDimension( 'overworld' ).runCommandAsync( 'fill -8 19 -17 -6 22 -17 stained_glass[ "color": "lime" ]' )
    world.getDimension( 'overworld' ).runCommandAsync( 'fill 0 19 -16 2 22 -16 stained_glass[ "color": "lime" ]' )
    world.getDimension( 'overworld' ).runCommandAsync( 'fill 8 20 -17 10 23 -17 stained_glass[ "color": "lime" ]' )
    world.getDimension( 'overworld' ).runCommandAsync( 'fill 2 16 15 0 19 15 stained_glass[ "color": "red" ]' )
    
    for ( const player of world.getAllPlayers() ) if ( players.has( player.nameTag ) ) players.get( player.nameTag ).team == 'green' ? player.runCommandAsync( 'tp @s 1 19 -19' ) : player.runCommandAsync( 'tp @s 1 16 17' )
    for ( let i = 1; i < 5; i++  ) {
        system.runTimeout( () => {
            for ( const player of world.getPlayers() ) {
                player.playSound( i < 4 ? 'pkt:countdown_high' : 'pkt:countdown_release', { volume: 1, pitch: 1, location: player.location } )
                player.onScreenDisplay.setTitle( i < 4 ? `${4 - i}` : 'GO!' )
            }
            if ( i == 4 ) {
                for ( const player of world.getAllPlayers() ) if ( players.has( player.nameTag ) ) players.get( player.nameTag ).team == 'red' ? player.addEffect( 'strength', timer, { amplifier: 100, showParticles: false } ) : player.addEffect( 'weakness', timer, { amplifier: 100, showParticles: false } )

                if ( effect ) world.getDimension( 'overworld' ).runCommandAsync( `effect @a darkness ${timer/20} 1 true` )
                world.getDimension( 'overworld' ).runCommandAsync( 'fill -8 19 -17 -6 22 -17 air destroy' )
                world.getDimension( 'overworld' ).runCommandAsync( 'fill 0 19 -16 2 22 -16 air destroy' )
                world.getDimension( 'overworld' ).runCommandAsync( 'fill 8 20 -17 10 23 -17 air destroy' )
                world.getDimension( 'overworld' ).runCommandAsync( 'fill 2 16 15 0 19 15 air destroy' )
                world.playMusic( 'pkt:parkour_tag', { volume: 1, fade: 1, loop: true } )
                tick()
            }
        }, i * 20 )
    } 
}

// Game ending sequence

const endGame = async ( team ) => {
    world.stopMusic()
    await world.getDimension( 'overworld' ).runCommandAsync( 'tp @a 0 36 0' )
    world.getDimension( 'overworld' ).runCommandAsync( 'effect @a clear' )
    world.getDimension( 'overworld' ).runCommandAsync( 'execute @a ~~~ playsound pkt:finish @s ~~~ 1 1 1' )
    world.getDimension( 'overworld' ).runCommandAsync( `title @a title ${team == 'green' ? 'Runners Survived!' : 'Runners Tagged!'}` )
    world.getDimension( 'overworld' ).runCommandAsync( 'replaceitem entity @a slot.hotbar 0 book 1 0 { "minecraft:item_lock": { "mode": "lock_in_slot" } }' )

    for ( const player of world.getAllPlayers() ) if ( players.has( player.nameTag ) ) {
        players.get( player.nameTag ).alive = true
        if ( players.get( player.nameTag ).team == 'red' ) player.runCommandAsync( 'replaceitem entity @s slot.hotbar 8 mojang_banner_pattern 1 0 { "minecraft:item_lock": { "mode": "lock_in_slot" } }' )
    }

    timer = setTimer
}

// Player data upon joining and leaving
world.afterEvents.playerJoin.subscribe( data => {
    getPlayer( data.playerName )
} )

function getPlayer( playerName ) {
    const [ player ] = world.getPlayers( { name: playerName } )
    if ( !player ) return system.runTimeout( () => getPlayer( playerName ), 5 )
    player.runCommandAsync( 'title @a times 5 10 5' )
    player.runCommandAsync( 'tp 0 36 0' )
    player.runCommandAsync( 'replaceitem entity @s slot.hotbar 0 book 1 0 { "minecraft:item_lock": { "mode": "lock_in_slot" } }' )
} 

world.afterEvents.entityDie.subscribe( data => {
    players.get( data.deadEntity.nameTag ).alive = false
} )

world.afterEvents.playerLeave.subscribe( data => {
    players.delete( data.playerName )
} )

// Item functionality and Server UI

world.afterEvents.itemUse.subscribe( data => {
    const item = data.itemStack.typeId
    const player = data.source
    switch ( item ) {
        case 'minecraft:book':
            switch ( true ) {
                case players.get( player.nameTag )?.team == 'green':
                    new ActionFormData().button( 'Leave' ).show( player ).then( data => {
                        if ( data.selection == 0 ) {
                            player.runCommandAsync( `tellraw @a { "rawtext": [ { "text": "${player.nameTag} has left the §aRunners§f." } ] }` )
                            players.delete( player.nameTag )
                        }
                    } )
                    break
                case players.get( player.nameTag )?.team == 'red':
                    new ActionFormData().button( 'Start' ).button( 'Leave' ).show( player ).then( data => {
                        if ( data.selection == 0 ) {
                            if ( Array.from( players ).filter( ( [ name, value ] ) => value.team == 'red' ).length == 0 ) {
                                return player.runCommandAsync( `tellraw @a { "rawtext": [ { "text": "There is no §cHunter§f." } ] }` )
                            }
                            if ( Array.from( players ).filter( ( [ name, value ] ) => value.team == 'green' ).length == 0 ) {
                                return player.runCommandAsync( `tellraw @a { "rawtext": [ { "text": "There are no §aRunners§f." } ] }` )
                            }
                            start()
                        }
                        if ( data.selection == 1 ) {
                            player.runCommandAsync( 'clear @s mojang_banner_pattern' )
                            player.runCommandAsync( `tellraw @a { "rawtext": [ { "text": "${player.nameTag} is no longer the §cHunter§f." } ] }` )
                            players.delete( player.nameTag )
                        }
                    } ) 
                    break
                default:
                    new ActionFormData().title( 'Select A team' ).button( 'Runners' ).button( 'Hunter' ).show( player ).then( data => {
                        if ( data.selection == 1 ) { if ( Array.from( players ).filter( ( [ name, value ] ) => value.team == 'red' ).length > 0 ) {
                            return player.runCommandAsync( 'tellraw @s { "rawtext": [ { "text": "There is already a §cHunter§f." } ] }' )
                        } player.runCommandAsync( 'replaceitem entity @s slot.hotbar 8 mojang_banner_pattern 1 0 { "minecraft:item_lock": { "mode": "lock_in_slot" } }' ) }
                        if ( data.selection == undefined ) return
                        player.runCommandAsync( `tellraw @a { "rawtext": [ { "text": "${player.nameTag} ${data.selection == 0 ? 'joined the §aRunners§f!' : 'is the §cHunter§f!'}" } ] }` )
                        players.set( player.nameTag, { team: data.selection == 0 ? 'green' : 'red', alive: true } )
                    } )
            }
            break
        case 'minecraft:mojang_banner_pattern':
            const modal = new ModalFormData()
                .title( 'Settings' )
                .slider( 'Timer', 30, 120, 5, timer / 20 )
                .toggle( 'Darkness', effect )
            modal.show( player ).then( data => {
                const [ newTimer, newEffect ] = data.formValues

                setTimer = ( newTimer ?? 60 ) * 20 
                timer = setTimer

                effect = newEffect ?? false
            } )
    }
} )
